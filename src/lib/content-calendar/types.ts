export type CalendarMode = "completo" | "leve";

export type CalendarStatus =
  | "pendente_geracao"
  | "gerando"
  | "gerado"
  | "aprovado"
  | "erro";

export interface GeneratedPost {
  ordem: number;
  tema: string;
  data_sugerida: string;
  tipo: "video" | "imagem" | "carrossel";
  legenda?: string;
  hashtags?: string[];
  primeiro_comentario?: string;
  roteiro?: string;
  material_estudo?: string;
  tendencia_fonte?: string;
  estrategia_mes?: string;
}

export interface ContentCalendarRow {
  id: string;
  organization_id: string;
  client_id: string;
  mes_referencia: string;
  modo: CalendarMode;
  status: CalendarStatus;
  posts_json: GeneratedPost[];
  pesquisa_tendencias: unknown;
  task_id: string | null;
  aprovado_por: string | null;
  aprovado_em: string | null;
  erro_msg: string | null;
  tentativas: number;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
}

export const PACOTES_CRONOGRAMA_COMPLETO = [
  "estrategia",
  "trafego_estrategia",
  "yide_360",
] as const;

export const PACOTES_CRONOGRAMA_LEVE = ["trafego"] as const;

export const PACOTES_COM_CRONOGRAMA = [
  ...PACOTES_CRONOGRAMA_COMPLETO,
  ...PACOTES_CRONOGRAMA_LEVE,
] as const;
