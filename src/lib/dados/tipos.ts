export const CANAIS = ["site", "google", "gmn", "instagram", "facebook", "anuncios", "ecommerce", "crm"] as const;
export type CanalId = (typeof CANAIS)[number];

export type StatusCanal = "ok" | "fraco" | "ausente" | "sem_acesso" | "nao_se_aplica";
export type Gravidade = "alta" | "media";

export type Metricas = Record<string, number | string | null>;

export interface ResultadoCanal {
  status: StatusCanal;
  /** Frase curta: motivo do status (vira a perda quando fraco/ausente). */
  motivo: string | null;
  metricas: Metricas;
}

export interface Perda { canal: CanalId; gravidade: Gravidade; texto: string }

export type CanaisResultado = Record<CanalId, ResultadoCanal>;

export interface SnapshotDados {
  nota: number | null;
  canais: CanaisResultado;
  perdas: Perda[];
}

export interface Periodo { de: string; ate: string } // YYYY-MM-DD

export const CANAL_LABEL: Record<CanalId, string> = {
  site: "Site",
  google: "Google busca",
  gmn: "Google Meu Negócio",
  instagram: "Instagram",
  facebook: "Facebook",
  anuncios: "Anúncios",
  ecommerce: "E-commerce",
  crm: "CRM",
};
