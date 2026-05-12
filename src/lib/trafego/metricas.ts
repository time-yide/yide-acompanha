/**
 * Lista de TODAS as métricas que o sistema sabe exibir.
 *
 * Cada métrica tem `key` (usado em DB e API) e `label` (PT-BR pra UI).
 * `categoria` agrupa visualmente no modal de configuração. `unidade` indica
 * como formatar o valor (R$, %, número, segundos).
 *
 * Quando integrarmos Meta/Google API (Fase 2), o sync usa essas keys pra
 * popular `trafego_metricas_diarias`.
 *
 * Pra adicionar uma métrica nova: adiciona aqui + update no sync da Fase 2.
 * Não precisa migration nova — a tabela é flexível.
 */

export type MetricaUnidade = "moeda" | "percentual" | "numero" | "segundos" | "decimal";
export type MetricaCategoria = "basica" | "conversao" | "engajamento" | "video" | "lead" | "google";
export type MetricaPlataforma = "meta" | "google" | "ambas";

export interface MetricaDef {
  key: string;
  label: string;
  descricao?: string;
  categoria: MetricaCategoria;
  unidade: MetricaUnidade;
  plataforma: MetricaPlataforma;
}

export const METRICAS_DISPONIVEIS: MetricaDef[] = [
  // === Básicas ===
  { key: "spend",        label: "Gasto",        categoria: "basica", unidade: "moeda",      plataforma: "ambas" },
  { key: "impressions",  label: "Impressões",   categoria: "basica", unidade: "numero",     plataforma: "ambas" },
  { key: "reach",        label: "Alcance",      categoria: "basica", unidade: "numero",     plataforma: "meta",
    descricao: "Pessoas únicas que viram o anúncio (Meta)" },
  { key: "clicks",       label: "Cliques",      categoria: "basica", unidade: "numero",     plataforma: "ambas" },
  { key: "link_clicks",  label: "Cliques no link", categoria: "basica", unidade: "numero",  plataforma: "meta" },
  { key: "ctr",          label: "CTR",          categoria: "basica", unidade: "percentual", plataforma: "ambas",
    descricao: "Taxa de cliques (cliques ÷ impressões)" },
  { key: "cpc",          label: "CPC",          categoria: "basica", unidade: "moeda",      plataforma: "ambas",
    descricao: "Custo por clique" },
  { key: "cpm",          label: "CPM",          categoria: "basica", unidade: "moeda",      plataforma: "ambas",
    descricao: "Custo por 1.000 impressões" },
  { key: "frequency",    label: "Frequência",   categoria: "basica", unidade: "decimal",    plataforma: "meta",
    descricao: "Quantas vezes a mesma pessoa viu o anúncio" },

  // === Conversão ===
  { key: "conversions",       label: "Conversões",        categoria: "conversao", unidade: "numero",     plataforma: "ambas" },
  { key: "cost_per_conversion", label: "Custo por conversão (CPA)", categoria: "conversao", unidade: "moeda", plataforma: "ambas" },
  { key: "conversion_rate",   label: "Taxa de conversão", categoria: "conversao", unidade: "percentual", plataforma: "ambas" },
  { key: "conversion_value",  label: "Valor de conversão", categoria: "conversao", unidade: "moeda",    plataforma: "ambas" },
  { key: "roas",              label: "ROAS",              categoria: "conversao", unidade: "decimal",    plataforma: "ambas",
    descricao: "Retorno sobre o investimento (valor ÷ gasto)" },

  // === Engajamento (Meta) ===
  { key: "post_reactions", label: "Curtidas/Reações", categoria: "engajamento", unidade: "numero", plataforma: "meta" },
  { key: "comments",       label: "Comentários",      categoria: "engajamento", unidade: "numero", plataforma: "meta" },
  { key: "shares",         label: "Compartilhamentos", categoria: "engajamento", unidade: "numero", plataforma: "meta" },
  { key: "post_saves",     label: "Salvamentos",      categoria: "engajamento", unidade: "numero", plataforma: "meta" },
  { key: "messaging_conversation_started", label: "Mensagens iniciadas", categoria: "engajamento", unidade: "numero", plataforma: "meta",
    descricao: "Direct, WhatsApp, Messenger" },
  { key: "page_likes",     label: "Curtidas na página", categoria: "engajamento", unidade: "numero", plataforma: "meta" },

  // === Vídeo (Meta) ===
  { key: "video_views",        label: "Visualizações 3s",   categoria: "video", unidade: "numero",  plataforma: "meta" },
  { key: "video_thruplay",     label: "ThruPlay",           categoria: "video", unidade: "numero",  plataforma: "meta",
    descricao: "Vídeo visto até 15s ou completo" },
  { key: "video_p100_watched", label: "% visto até o fim",  categoria: "video", unidade: "percentual", plataforma: "meta" },
  { key: "cost_per_thruplay",  label: "Custo por ThruPlay", categoria: "video", unidade: "moeda",   plataforma: "meta" },

  // === Leads ===
  { key: "leads",          label: "Leads capturados",   categoria: "lead", unidade: "numero", plataforma: "ambas" },
  { key: "cost_per_lead",  label: "Custo por lead (CPL)", categoria: "lead", unidade: "moeda", plataforma: "ambas" },

  // === Google-específico ===
  { key: "quality_score",          label: "Quality Score",         categoria: "google", unidade: "numero",     plataforma: "google" },
  { key: "search_impression_share", label: "Search Impression Share", categoria: "google", unidade: "percentual", plataforma: "google",
    descricao: "Quantas das buscas elegíveis seu anúncio apareceu" },
  { key: "average_position",       label: "Posição média",         categoria: "google", unidade: "decimal",    plataforma: "google" },
];

export const METRICA_KEYS = METRICAS_DISPONIVEIS.map((m) => m.key);

export const METRICA_BY_KEY: Record<string, MetricaDef> = Object.fromEntries(
  METRICAS_DISPONIVEIS.map((m) => [m.key, m]),
);

export const CATEGORIA_LABELS: Record<MetricaCategoria, string> = {
  basica: "Básicas",
  conversao: "Conversão",
  engajamento: "Engajamento (Meta)",
  video: "Vídeo (Meta)",
  lead: "Leads",
  google: "Google Ads",
};

/** Default: kit padrão de agência. Aplicado quando user nunca configurou. */
export const METRICAS_DEFAULT: string[] = [
  "spend", "impressions", "clicks", "ctr", "cpc", "cpm",
  "conversions", "cost_per_conversion", "roas",
  "reach", "frequency", "messaging_conversation_started",
  "leads", "cost_per_lead",
];

/** Formata um valor pra exibição conforme a unidade. */
export function formatMetricaValor(valor: number | null | undefined, unidade: MetricaUnidade): string {
  if (valor === null || valor === undefined) return "—";
  switch (unidade) {
    case "moeda":
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 2,
      }).format(valor);
    case "percentual":
      return `${valor.toFixed(2)}%`;
    case "numero":
      return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(valor);
    case "decimal":
      return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(valor);
    case "segundos":
      return `${valor.toFixed(1)}s`;
  }
}

export const PLATAFORMAS = [
  { value: "meta", label: "Meta (Facebook/Instagram)" },
  { value: "google", label: "Google Ads" },
] as const;

export const OBJETIVOS = [
  { value: "trafego",     label: "Tráfego" },
  { value: "conversoes",  label: "Conversões" },
  { value: "alcance",     label: "Alcance" },
  { value: "engajamento", label: "Engajamento" },
  { value: "leads",       label: "Geração de leads" },
  { value: "mensagens",   label: "Mensagens (DM/WhatsApp)" },
  { value: "video",       label: "Visualizações de vídeo" },
  { value: "vendas",      label: "Vendas no catálogo" },
  { value: "instalacoes", label: "Instalações de app" },
] as const;

export const STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  ativa: "Ativa",
  pausada: "Pausada",
  finalizada: "Finalizada",
  rejeitada: "Rejeitada",
};

export const STATUS_COLORS: Record<string, string> = {
  rascunho:   "border-muted-foreground/30 text-muted-foreground",
  ativa:      "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  pausada:    "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  finalizada: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  rejeitada:  "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
};
