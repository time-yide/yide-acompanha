/**
 * Critério de "tarefa atrasada" POR CARGO.
 *
 * O que conta como "entregue" (e portanto tira a tarefa de atrasada) depende do
 * cargo de quem a tarefa está atribuída:
 *
 *  - Cargos OPERACIONAIS (produção): entregam ao chegar em "Concluído
 *    operacional". Depois disso (aprovação/aprovada/agendado/postada) o trabalho
 *    deles já saiu das mãos — não estão mais atrasados.
 *  - Demais cargos (assessor, e-commerce, adm, sócio, comercial, programação):
 *    só entregam quando a tarefa está "Postado/Entregue".
 *
 * Módulo puro (sem "use server") pra poder ser importado por qualquer lado.
 * Fonte única — se mudar a regra de um cargo, muda aqui.
 */

/** Cargos cujo "entregue" é Concluído Operacional (o resto entrega só em Postada). */
export const ROLES_ENTREGA_OPERACIONAL = [
  "editor",
  "videomaker",
  "fast_midia",
  "designer",
  "audiovisual_chefe",
  "coordenador",
] as const;

/**
 * Status em que um cargo OPERACIONAL ainda tem trabalho na tarefa (antes de
 * "Concluído operacional"). `alteracao` volta pras mãos dele, então conta.
 * Tudo além de `concluida` (em_aprovacao/aprovada/agendado/postada) = entregue.
 */
const STATUS_OPERACIONAL_EM_ABERTO = new Set([
  "aberta",
  "em_andamento",
  "alteracao",
]);

function isRoleEntregaOperacional(role: string | null | undefined): boolean {
  return (ROLES_ENTREGA_OPERACIONAL as readonly string[]).includes(role ?? "");
}

/**
 * Decide se uma tarefa conta como atrasada pro cargo dono dela.
 *
 * IMPORTANTE: assume que a tarefa já foi pré-filtrada por prazo vencido
 * (`due_date < hoje`), não deletada (`deleted_at is null`) e ainda não postada
 * (`status != 'postada'` — postada é entregue pra todo cargo).
 */
export function isTarefaAtrasadaParaCargo(
  status: string,
  role: string | null | undefined,
): boolean {
  if (isRoleEntregaOperacional(role)) {
    // Operacional só está atrasado enquanto não chegou em "Concluído operacional".
    return STATUS_OPERACIONAL_EM_ABERTO.has(status);
  }
  // Entrega final (postada): como o candidato já teve postada excluída no SQL,
  // qualquer status restante (inclusive "concluida" sem postar) conta.
  return true;
}
