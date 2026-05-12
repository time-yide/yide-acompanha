/**
 * Tipos compartilhados do módulo Gerador de Leads.
 */

export const STATUS_LEAD_VALORES = [
  "novo",
  "em_contato",
  "qualificado",
  "reuniao_marcada",
  "proposta_enviada",
  "cliente",
  "descartado",
] as const;

export type StatusLead = (typeof STATUS_LEAD_VALORES)[number];

export const STATUS_LEAD_DEFS: Record<StatusLead, { label: string; color: string }> = {
  novo: {
    label: "Novo",
    color: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  },
  em_contato: {
    label: "Em contato",
    color: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  qualificado: {
    label: "Qualificado",
    color: "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
  reuniao_marcada: {
    label: "Reunião marcada",
    color: "border-cyan-500/40 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  },
  proposta_enviada: {
    label: "Proposta enviada",
    color: "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  },
  cliente: {
    label: "Cliente",
    color: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  descartado: {
    label: "Descartado",
    color: "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
  },
};

export const STATUS_PESQUISA_DEFS: Record<string, { label: string; color: string }> = {
  pendente: {
    label: "Na fila",
    color: "border-muted-foreground/30 text-muted-foreground",
  },
  processando: {
    label: "Processando",
    color: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  concluido: {
    label: "Concluído",
    color: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  erro: {
    label: "Erro",
    color: "border-destructive/40 bg-destructive/10 text-destructive",
  },
};

export const POTENCIAL_DEFS: Record<string, { label: string; color: string }> = {
  alto: {
    label: "Alto",
    color: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  medio: {
    label: "Médio",
    color: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  baixo: {
    label: "Baixo",
    color: "border-muted-foreground/30 text-muted-foreground",
  },
};
