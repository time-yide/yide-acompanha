export const TIPOS_PACOTE = [
  "trafego_estrategia",
  "trafego",
  "estrategia",
  "audiovisual",
  "yide_360",
  "site",
  "ia",
  "crm",
  "crm_ia",
] as const;
export type TipoPacote = (typeof TIPOS_PACOTE)[number];

export const COLUMN_KEYS = [
  "crono",
  "design",
  "tpg",
  "tpm",
  "gmn",
  "camera",
  "mobile",
  "edicao",
  "reuniao",
  "pacote_postados",
] as const;
export type ColumnKey = (typeof COLUMN_KEYS)[number];

export type ColumnFlags = Record<ColumnKey, 0 | 1>;

const NOTHING: ColumnFlags = {
  crono: 0, design: 0, tpg: 0, tpm: 0, gmn: 0,
  camera: 0, mobile: 0, edicao: 0, reuniao: 0, pacote_postados: 0,
};

export const PACOTE_COLUMNS: Record<TipoPacote, ColumnFlags> = {
  trafego_estrategia: {
    crono: 1, design: 1, tpg: 1, tpm: 1, gmn: 1,
    camera: 1, mobile: 1, edicao: 1, reuniao: 1, pacote_postados: 1,
  },
  trafego: {
    crono: 0, design: 1, tpg: 1, tpm: 1, gmn: 0,
    camera: 0, mobile: 0, edicao: 0, reuniao: 1, pacote_postados: 0,
  },
  estrategia: {
    crono: 1, design: 1, tpg: 0, tpm: 0, gmn: 1,
    camera: 1, mobile: 1, edicao: 1, reuniao: 1, pacote_postados: 1,
  },
  audiovisual: {
    crono: 1, design: 0, tpg: 0, tpm: 0, gmn: 0,
    camera: 1, mobile: 1, edicao: 1, reuniao: 1, pacote_postados: 0,
  },
  yide_360: {
    crono: 1, design: 1, tpg: 1, tpm: 1, gmn: 1,
    camera: 1, mobile: 1, edicao: 1, reuniao: 1, pacote_postados: 1,
  },
  site: { ...NOTHING },
  ia: { ...NOTHING },
  crm: { ...NOTHING },
  crm_ia: { ...NOTHING },
};

export const PACOTES_NO_PAINEL_MENSAL: readonly TipoPacote[] = [
  "trafego_estrategia",
  "trafego",
  "estrategia",
  "audiovisual",
  "yide_360",
];

export function isApplicable(pacote: TipoPacote, coluna: ColumnKey): boolean {
  return PACOTE_COLUMNS[pacote][coluna] === 1;
}

export interface BadgeMeta {
  label: string;
  /** Tailwind classes p/ background, text, e (opcionalmente) gradient */
  classes: string;
}

export function tipoPacoteBadge(pacote: TipoPacote): BadgeMeta {
  switch (pacote) {
    case "trafego_estrategia":
      return { label: "Tráfego+Estratégia", classes: "bg-primary/15 text-primary border-primary/30" };
    case "trafego":
      return { label: "Tráfego", classes: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30" };
    case "estrategia":
      return { label: "Estratégia", classes: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30" };
    case "audiovisual":
      return { label: "Audiovisual", classes: "bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/30" };
    case "yide_360":
      return { label: "Yide 360°", classes: "bg-gradient-to-r from-amber-500 to-yellow-600 text-white border-amber-500/30" };
    case "site":
      return { label: "Site", classes: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30" };
    case "ia":
      return { label: "IA", classes: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" };
    case "crm":
      return { label: "CRM", classes: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30" };
    case "crm_ia":
      return { label: "CRM+IA", classes: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30" };
  }
}
