export const STATUS_OP = ["disponivel", "pega", "em_negociacao", "fechada", "perdida"] as const;
export type StatusOp = (typeof STATUS_OP)[number];

export const STATUS_OP_DEFS: Record<StatusOp, { label: string; emoji: string; color: string }> = {
  disponivel:    { label: "Disponível",    emoji: "🟢", color: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  pega:          { label: "Pega",          emoji: "🔵", color: "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  em_negociacao: { label: "Em negociação", emoji: "🟡", color: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  fechada:       { label: "Fechada",       emoji: "🏆", color: "border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-300" },
  perdida:       { label: "Perdida",       emoji: "⚪", color: "border-muted-foreground/30 bg-muted/40 text-muted-foreground" },
};

export const TIPO_ALVO_DEFS: Record<string, string> = {
  pontos: "pontos",
  fechamentos: "captações fechadas",
  comissao: "R$ em comissão",
};
