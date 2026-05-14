/**
 * Tipos compartilhados do módulo Ligações.
 */

export const TIPOS_LIGACAO = ["telefone", "whatsapp"] as const;
export type TipoLigacao = (typeof TIPOS_LIGACAO)[number];

export const DIRECOES = ["saida", "entrada"] as const;
export type Direcao = (typeof DIRECOES)[number];

export const STATUS_LIGACAO = [
  "atendida",
  "perdida",
  "rejeitada",
  "caixa_postal",
  "ocupada",
  "cancelada",
  "em_andamento",
] as const;
export type StatusLigacao = (typeof STATUS_LIGACAO)[number];

export const STATUS_DEFS: Record<StatusLigacao, { label: string; color: string }> = {
  atendida: {
    label: "Atendida",
    color: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  perdida: {
    label: "Perdida",
    color: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  rejeitada: {
    label: "Rejeitada",
    color: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  },
  caixa_postal: {
    label: "Caixa postal",
    color: "border-slate-500/40 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  },
  ocupada: {
    label: "Ocupada",
    color: "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  },
  cancelada: {
    label: "Cancelada",
    color: "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
  },
  em_andamento: {
    label: "Em andamento",
    color: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  },
};

export const TIPO_DEFS: Record<TipoLigacao, { label: string; color: string; icon: string }> = {
  telefone: {
    label: "Telefone",
    color: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
    icon: "phone",
  },
  whatsapp: {
    label: "WhatsApp",
    color: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    icon: "message-circle",
  },
};

export const ORIGENS = [
  "manual", "twilio", "evolution", "zapi", "ifix", "voip_generic", "mock", "outro",
] as const;
export type Origem = (typeof ORIGENS)[number];

export const ORIGEM_LABELS: Record<Origem, string> = {
  manual: "Manual",
  twilio: "Twilio",
  evolution: "Evolution",
  zapi: "Z-API",
  ifix: "iFix",
  voip_generic: "VoIP",
  mock: "Mock (demo)",
  outro: "Outro",
};

/**
 * Formata duração em segundos pra "Xmin Ys" ou "Xs".
 */
export function formatDuracao(segundos: number | null | undefined): string {
  if (!segundos || segundos < 0) return "";
  if (segundos < 60) return `${segundos}s`;
  const min = Math.floor(segundos / 60);
  const sec = segundos % 60;
  if (min < 60) return sec > 0 ? `${min}min ${sec}s` : `${min}min`;
  const h = Math.floor(min / 60);
  const restMin = min % 60;
  return restMin > 0 ? `${h}h ${restMin}min` : `${h}h`;
}

/**
 * Formata número de telefone BR pra exibição: +5511999999999 → (11) 99999-9999
 */
export function formatNumeroBR(numero: string | null | undefined): string {
  if (!numero) return "";
  const cleaned = numero.replace(/\D/g, "");
  // Com DDI 55
  if (cleaned.length === 13 && cleaned.startsWith("55")) {
    const ddd = cleaned.slice(2, 4);
    const part1 = cleaned.slice(4, 9);
    const part2 = cleaned.slice(9, 13);
    return `(${ddd}) ${part1}-${part2}`;
  }
  // Sem DDI, 11 digitos (celular)
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  // Sem DDI, 10 digitos (fixo)
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  return numero;
}
