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
