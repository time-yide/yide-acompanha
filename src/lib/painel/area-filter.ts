import { PACOTE_COLUMNS, type TipoPacote } from "./pacote-matrix";

export const AREA_FILTERS = [
  "todos",
  "trafego",
  "estrategia",
  "audiovisual",
  "edicao",
  "yide_360",
] as const;
export type AreaFilter = (typeof AREA_FILTERS)[number];

export const AREA_LABELS: Record<AreaFilter, string> = {
  todos: "Todos",
  trafego: "Tráfego",
  estrategia: "Estratégia",
  audiovisual: "Audiovisual",
  edicao: "Edição",
  yide_360: "Yide 360°",
};

export const AREA_CHIP_CLASSES: Record<AreaFilter, string> = {
  todos: "border-foreground/30 bg-foreground/5",
  trafego: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  estrategia: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
  audiovisual: "bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/30",
  edicao: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
  yide_360: "bg-gradient-to-r from-amber-500 to-yellow-600 text-white border-amber-500/30",
};

export function parseArea(raw: string | undefined): AreaFilter {
  if (raw && (AREA_FILTERS as readonly string[]).includes(raw)) return raw as AreaFilter;
  return "todos";
}

/**
 * Pacote do cliente bate com a área selecionada?
 * Mapping conforme as colunas que cada pacote habilita (ver PACOTE_COLUMNS).
 */
export function matchesArea(pacote: TipoPacote, area: AreaFilter): boolean {
  if (area === "todos") return true;
  if (area === "yide_360") return pacote === "yide_360";
  const flags = PACOTE_COLUMNS[pacote];
  if (area === "trafego") return flags.tpg === 1 || flags.tpm === 1;
  if (area === "estrategia") return ["trafego_estrategia", "estrategia", "yide_360"].includes(pacote);
  if (area === "audiovisual") return flags.camera === 1 || flags.edicao === 1;
  if (area === "edicao") return flags.edicao === 1;
  return true;
}
