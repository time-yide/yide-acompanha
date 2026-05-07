"use client";

import { useRealtimeRefresh } from "@/lib/supabase/use-realtime-refresh";

/**
 * Headless: ouve qualquer mudança na tabela tasks e dispara
 * router.refresh() pra re-renderizar a lista/board ao vivo.
 * Sem filtro — todos os usuários veem o mesmo board.
 */
export function TasksRealtimeWatcher() {
  useRealtimeRefresh("tasks-list-board", "tasks");
  return null;
}
