"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { authenticateRealtime } from "./realtime-auth";

/**
 * Hook genérico: subscribe a qualquer mudança em uma tabela e dispara
 * router.refresh() quando algo acontece. Útil pra páginas server-rendered
 * que precisam refletir mutações ao vivo (kanban de tarefas, kanban de
 * leads, listas que mostram dados compartilhados).
 *
 * Cobre INSERT, UPDATE e DELETE — Next.js só re-renderiza o que muda.
 *
 * @param channelName  Nome único do canal Supabase (qualquer string, só
 *                     pra evitar colisão entre vários hooks na mesma page)
 * @param table        Nome da tabela em public (ex.: "tasks", "leads")
 * @param filter       Filtro opcional no formato PostgREST (ex.:
 *                     "user_id=eq.{uuid}"). Quando ausente, escuta todas
 *                     as rows.
 */
export function useRealtimeRefresh(channelName: string, table: string, filter?: string) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let channelRef: any = null;
    let unsubAuth: (() => void) | null = null;

    async function start() {
      unsubAuth = await authenticateRealtime(supabase);
      if (cancelled) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const config: any = { event: "*", schema: "public", table };
      if (filter) config.filter = filter;

      const ch = supabase
        .channel(channelName)
        .on("postgres_changes", config, () => {
          router.refresh();
        })
        .subscribe();

      channelRef = ch;
    }

    void start();

    return () => {
      cancelled = true;
      unsubAuth?.();
      if (channelRef) supabase.removeChannel(channelRef);
    };
  }, [channelName, table, filter, router]);
}
