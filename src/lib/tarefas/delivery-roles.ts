/**
 * Papéis que entregam material (link do Drive obrigatório ao mover pra
 * "Concluído Operacional" ou "Aprovação").
 *
 * FONTE ÚNICA: importada tanto pelo server action (moveTaskStatusAction /
 * concludeOperationalAction) quanto pelo client (TasksBoard). Antes as listas
 * eram duplicadas nos dois lados e divergiram — foi isso que deixou o papel
 * `fast_midia` (que funciona como videomaker) escapar do modal de entrega e
 * concluir tarefas sem link. Mantenha os dois lados sempre daqui.
 *
 * Módulo puro (sem "use server") de propósito, pra poder ser importado por
 * client components.
 */

export const ROLES_QUE_ENTREGAM = [
  "editor",
  "videomaker",
  "fast_midia",
  "designer",
  "audiovisual_chefe",
  "coordenador",
  "assessor",
] as const;
export type RoleQueEntrega = (typeof ROLES_QUE_ENTREGAM)[number];

export function isRoleQueEntrega(role: string | null | undefined): boolean {
  return (ROLES_QUE_ENTREGAM as readonly string[]).includes(role ?? "");
}

// Papéis do audiovisual que SEMPRE entregam material pronto: pra eles o link
// de entrega é obrigatório em QUALQUER tipo de tarefa (inclusive "geral"), não
// só vídeo/arte. Assessor fica de fora de propósito — suas tarefas "geral"
// (reunião, follow-up, acompanhamento) não têm material pra linkar.
export const ROLES_ENTREGA_SEMPRE = [
  "editor",
  "videomaker",
  "fast_midia",
  "designer",
  "audiovisual_chefe",
  "coordenador",
] as const;

export function isRoleEntregaSempre(role: string | null | undefined): boolean {
  return (ROLES_ENTREGA_SEMPRE as readonly string[]).includes(role ?? "");
}

// Papéis cujo material entregue é VÍDEO (vai pro Frame em vez de link do Drive).
// fast_midia funciona como videomaker (ver memória do projeto), então entra aqui.
export const VIDEO_ROLES = [
  "editor",
  "videomaker",
  "videomaker_mobile",
  "fast_midia",
  "audiovisual_chefe",
] as const;

/**
 * Decide se a entrega de uma tarefa é de vídeo (sobe pro Frame) ou não (link do
 * Drive). tipo 'video' → sempre; 'arte' → nunca; 'geral' → desempata pelo papel.
 * Fonte única usada pelo modal (client) e por concludeOperationalAction (server).
 */
export function isVideoDelivery(
  tipo: string | null | undefined,
  role: string | null | undefined,
): boolean {
  if (tipo === "video") return true;
  if (tipo === "arte") return false;
  return (VIDEO_ROLES as readonly string[]).includes(role ?? "");
}

/**
 * Decide se mover uma tarefa pra "Concluído Operacional"/"Aprovação" precisa
 * passar pelo modal de entrega. Fonte única (client TasksBoard + server
 * moveTaskStatusAction/toggleTaskCompletionAction), pra não divergir.
 *
 * - VÍDEO: SEMPRE pede (sobe pro Frame; ignora `drive_link` — a entrega é o
 *   Frame, não o link. Sem isso, tarefa com link antigo pulava o modal).
 * - Arte/geral com material: pede se ainda não tem `drive_link` (pedido 1x).
 * - Papel sem entrega (adm/sócio) ou sem responsável: não pede.
 */
export function precisaModalDeEntrega(
  tipo: string | null | undefined,
  role: string | null | undefined,
  driveLink: string | null | undefined,
): boolean {
  if (!isRoleQueEntrega(role)) return false;
  const tipoEntrega = tipo === "video" || tipo === "arte";
  const requiresDelivery = tipoEntrega || isRoleEntregaSempre(role);
  if (!requiresDelivery) return false;
  if (isVideoDelivery(tipo, role)) return true; // vídeo sempre
  return !driveLink; // arte/geral: pula se já tem link
}
