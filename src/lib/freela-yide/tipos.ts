export const STATUS_OP = ["disponivel", "pega", "em_negociacao", "fechada", "perdida"] as const;
export type StatusOp = (typeof STATUS_OP)[number];

export const STATUS_OP_DEFS: Record<StatusOp, { label: string; color: string }> = {
  disponivel:    { label: "Disponível",    color: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  pega:          { label: "Pega",          color: "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  em_negociacao: { label: "Em andamento",  color: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  fechada:       { label: "Concluída",     color: "border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-300" },
  perdida:       { label: "Cancelada",     color: "border-muted-foreground/30 bg-muted/40 text-muted-foreground" },
};

export const TIPO_ALVO_DEFS: Record<string, string> = {
  pontos: "pontos",
  fechamentos: "captações fechadas",
  comissao: "R$ em valor",
};

export const TIPO_OP = ["captacao", "modelo", "edicao"] as const;
export type TipoOp = (typeof TIPO_OP)[number];
export const TIPO_OP_DEFS: Record<TipoOp, { label: string; color: string }> = {
  captacao: { label: "Captação", color: "border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-300" },
  modelo:   { label: "Modelo",   color: "border-cyan-500/40 bg-cyan-500/10 text-cyan-600 dark:text-cyan-300" },
  edicao:   { label: "Edição",   color: "border-orange-500/40 bg-orange-500/10 text-orange-600 dark:text-orange-300" },
};
