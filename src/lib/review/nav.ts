/**
 * Destino do link de um review na lista do Audiovisual: a TAREFA quando há
 * vínculo (Review abre lá dentro); senão, a tela avulsa (review legado).
 */
export function reviewHref(taskId: string | null, reviewId: string): string {
  return taskId ? `/tarefas/${taskId}` : `/audiovisual/review/${reviewId}`;
}
