// Pure function for deriving audiovisual capture status (no dependencies)

export type StatusAtual = "Concluída" | "Em edição" | "Aguardando delegação";

const TASK_STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  alteracao: "Alteração",
  em_aprovacao: "Em aprovação",
  concluida: "Concluída",
  aprovada: "Aprovada",
  agendado: "Agendado",
  postada: "Postada",
};

/**
 * Pure function: deriva o status visível na UI a partir da captura + task vinculada.
 *   concluida_em != null                           -> "Concluída"
 *   task.status in [postada, aprovada, concluida] -> "Concluída" (terminal statuses)
 *   task != null                                   -> "Em edição" + label do status da task
 *   sem task                                       -> "Aguardando delegação"
 */
export function derivarStatusAtual(input: {
  concluida_em: string | null;
  task: { status: string } | null;
}): { statusAtual: StatusAtual; statusDetalhe: string | null } {
  if (input.concluida_em) return { statusAtual: "Concluída", statusDetalhe: null };
  if (input.task && ["concluida", "aprovada", "postada"].includes(input.task.status)) {
    return { statusAtual: "Concluída", statusDetalhe: null };
  }
  if (input.task) {
    const label = TASK_STATUS_LABEL[input.task.status] ?? input.task.status;
    return { statusAtual: "Em edição", statusDetalhe: label };
  }
  return { statusAtual: "Aguardando delegação", statusDetalhe: null };
}
