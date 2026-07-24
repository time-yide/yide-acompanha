import { canAccess, canManageAnyTask } from "@/lib/auth/permissions";

/** Sobe vídeo / comenta / nova versão (time audiovisual). */
export function podeGerenciarReview(role: string): boolean {
  return canAccess(role, "manage:review");
}

/** Pode ABRIR/ver o review: audiovisual (manage:review) OU gestão de tarefa. */
export function podeVerReview(user: { role: string }): boolean {
  return canAccess(user.role, "manage:review") || canManageAnyTask(user);
}

/** Aprova / pede alteração: gestor de tarefa OU criador da tarefa vinculada. */
export function podeAprovarReview(
  user: { id: string; role: string },
  taskCriadoPor: string | null,
): boolean {
  return canManageAnyTask(user) || (taskCriadoPor != null && taskCriadoPor === user.id);
}
