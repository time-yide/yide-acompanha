// src/lib/instagram-snapshots/tipos.ts
//
// Tipos do módulo de snapshots de Instagram. Estritamente tipados pra que
// o resto do código não precise lidar com unknown vindo do JSONB.

export type PostType = "feed" | "reel";

export interface PostRecente {
  url: string;
  /** ISO timestamp em UTC. */
  timestamp: string;
  type: PostType;
}

export type ScrapeStatus =
  | "ok"
  | "profile_not_found"
  | "rate_limit"
  | "error"
  | "no_url";

export interface SnapshotRow {
  id: string;
  client_id: string;
  organization_id: string;
  scraped_at: string;
  total_posts: number | null;
  recent_posts: PostRecente[];
  scrape_status: ScrapeStatus;
  erro: string | null;
  triggered_by: string;
  created_at: string;
}

/** Contagens calculadas em runtime a partir de recent_posts. */
export interface CountsBucket {
  hoje: number;
  semana: number;
  mes: number;
}

/** Pacotes elegíveis pra contagem (clientes com postagem orgânica regular). */
export const PACOTES_ELEGIVEIS = [
  "yide_360",
  "estrategia",
  "trafego_estrategia",
] as const;

export type PacoteElegivel = (typeof PACOTES_ELEGIVEIS)[number];

export function isPacoteElegivel(p: string | null | undefined): p is PacoteElegivel {
  return p !== null && p !== undefined && (PACOTES_ELEGIVEIS as readonly string[]).includes(p);
}
