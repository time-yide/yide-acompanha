export const EDITOR_IA_STATUS = [
  "enviando", "transcrevendo", "planejando", "aguardando_revisao", "renderizando", "pronto", "erro",
] as const;
export type EditorIaStatus = (typeof EDITOR_IA_STATUS)[number];

export const EDITOR_IA_STATUS_LABELS: Record<EditorIaStatus, string> = {
  enviando: "Enviando",
  transcrevendo: "Transcrevendo",
  planejando: "Planejando (IA)",
  aguardando_revisao: "Aguardando revisão",
  renderizando: "Renderizando",
  pronto: "Pronto",
  erro: "Erro",
};

/** Um trecho do vídeo (em segundos). keep=false significa cortado. */
export interface EditSegment {
  start: number;
  end: number;
  keep: boolean;
}

/** Uma linha de legenda (em segundos, no tempo do vídeo original). */
export interface CaptionLine {
  start: number;
  end: number;
  text: string;
}

/** Plano de edicao: o que manter e a legenda. Editavel na timeline. */
export interface EditPlan {
  segments: EditSegment[];
  captions: CaptionLine[];
}
