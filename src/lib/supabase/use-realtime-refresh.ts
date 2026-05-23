"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { authenticateRealtime } from "./realtime-auth";

/** Janela de debounce em ms - coalesce eventos rápidos num só refresh. */
const REFRESH_DEBOUNCE_MS = 300;

/**
 * Hook genérico: subscribe a qualquer mudança em uma tabela e dispara
 * router.refresh() quando algo acontece. Útil pra páginas server-rendered
 * que precisam refletir mutações ao vivo (kanban de tarefas, kanban de
 * leads, listas que mostram dados compartilhados).
 *
 * Cobre INSERT, UPDATE e DELETE - Next.js só re-renderiza o que muda.
 *
 * Refresh é debounced em 300ms: batch updates (ex.: import em lote, mover
 * 5 cards rápido, bulk assign) viram UM refresh em vez de N.
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
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    function scheduleRefresh() {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        if (!cancelled) router.refresh();
      }, REFRESH_DEBOUNCE_MS);
    }

    async function start() {
      unsubAuth = await authenticateRealtime(supabase);
      if (cancelled) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const config: any = { event: "*", schema: "public", table };
      if (filter) config.filter = filter;

      const ch = supabase
        .channel(channelName)
        .on("postgres_changes", config, () => {
          scheduleRefresh();
        })
        .subscribe();

      channelRef = ch;
    }

    void start();

    return () => {
      cancelled = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      unsubAuth?.();
      if (channelRef) supabase.removeChannel(channelRef);
    };
  }, [channelName, table, filter, router]);
}
