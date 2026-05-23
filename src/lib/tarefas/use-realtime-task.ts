"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { authenticateRealtime } from "@/lib/supabase/realtime-auth";

/**
 * Subscribe a UPDATEs da task atual e re-fetcha o server component via
 * router.refresh() quando algo muda (status, atribuição, prioridade,
 * aprovação, etc). Mais simples que sincronizar todo o state da página
 * - Next.js só re-renderiza o que realmente mudou.
 *
 * Uso: <TaskRealtimeWatcher taskId={task.id} /> dentro do server
 * component da página de detalhe.
 */
export function useRealtimeTask(taskId: string | null) {
  const router = useRouter();

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
        .channel(`task-updates:${taskId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "tasks",
            filter: `id=eq.${taskId}`,
          },
          () => {
            router.refresh();
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
  }, [taskId, router]);
}
