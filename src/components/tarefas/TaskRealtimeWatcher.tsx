"use client";

import { useRealtimeTask } from "@/lib/tarefas/use-realtime-task";

/**
 * Componente headless: assina UPDATE events da task e dispara
 * router.refresh() quando algo muda. Não renderiza UI — só efeitos
 * colaterais. Injetado no server component da página de detalhe.
 */
export function TaskRealtimeWatcher({ taskId }: { taskId: string }) {
  useRealtimeTask(taskId);
  return null;
}
