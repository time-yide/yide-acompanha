"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { authenticateRealtime } from "@/lib/supabase/realtime-auth";
import type { TaskComment } from "./queries";

interface RealtimePayload {
  new: { id: string; task_id: string };
}

/**
 * Subscribe a inserts em task_comments da tarefa atual. Quando chega
 * comentário novo (de qualquer usuário), faz fetch dos dados completos
 * (com autor) e adiciona ao state, deduplicando por id.
 *
 * O caller deve passar key={task.id} no componente pai pra forçar
 * remount quando trocar de tarefa.
 */
export function useRealtimeTaskComments(taskId: string | null, initialComments: TaskComment[]) {
  const [comments, setComments] = useState<TaskComment[]>(initialComments);

  useEffect(() => {
    if (!taskId) return;
    const supabase = createClient();
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let channelRef: any = null;
    let unsubAuth: (() => void) | null = null;

    async function start() {
      unsubAuth = await authenticateRealtime(supabase);
      if (cancelled) return;

      const ch = supabase
        .channel(`task-comments:${taskId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "task_comments",
            filter: `task_id=eq.${taskId}`,
          },
          async (payload: RealtimePayload) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const sb = supabase as any;
            const { data } = await sb
              .from("task_comments")
              .select(`
                id, task_id, autor_id, conteudo, criado_em,
                autor:profiles!task_comments_autor_id_fkey(id, nome, avatar_url)
              `)
              .eq("id", payload.new.id)
              .maybeSingle();
            if (!data) return;

            setComments((prev) => {
              if (prev.some((c) => c.id === data.id)) return prev;
              return [...prev, data as TaskComment];
            });
          },
        )
        .subscribe();

      channelRef = ch;
    }

    void start();

    return () => {
      cancelled = true;
      unsubAuth?.();
      if (channelRef) supabase.removeChannel(channelRef);
    };
  }, [taskId]);

  return { comments, setComments };
}
