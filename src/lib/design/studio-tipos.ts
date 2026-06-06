// src/lib/design/studio-tipos.ts

/** Dimensões reais (px) por formato. A canvas é exibida escalada, mas o estado
 * e o export usam estas medidas. */
export const FORMAT_DIMS: Record<string, { w: number; h: number }> = {
  feed: { w: 1080, h: 1080 },
  story: { w: 1080, h: 1920 },
  reels: { w: 1080, h: 1920 },
  carrossel: { w: 1080, h: 1080 },
};

export function dimensoesDoFormato(formato: string): { w: number; h: number } {
  return FORMAT_DIMS[formato] ?? FORMAT_DIMS.feed;
}

export type CamadaBase = {
  id: string;
  x: number;
  y: number;
  opacity: number;
  z: number;
};

export type CamadaTexto = CamadaBase & {
  tipo: "texto";
  text: string;
  w: number;
  fontSize: number;
  fontWeight: number;
  color: string;
  align: "left" | "center" | "right";
  font: string;
  spacing: number;
};

export type CamadaShape = CamadaBase & {
  tipo: "shape";
  subtype: "rect" | "circle" | "line";
  w: number;
  h: number;
  bg: string;
  borderColor: string;
  borderW: number;
  radius: number;
};

export type CamadaImagem = CamadaBase & {
  tipo: "imagem";
  src: string;
  w: number;
  h: number;
};

export type CamadaLogo = CamadaBase & {
  tipo: "logo";
  src: string;
  w: number;
  h: number;
};

export type Camada = CamadaTexto | CamadaShape | CamadaImagem | CamadaLogo;

export interface Composicao {
  formato: string;
  fundo: {
    cor: string;
    foto: { url: string; zoom: number; x: number; y: number; opacidade: number } | null;
    listras: boolean;
  };
  camadas: Camada[];
}

export interface FonteMarca {
  nome: string;
  papel: "titulo" | "corpo";
  url: string;
  format: "truetype" | "opentype" | "woff" | "woff2";
}

export interface ManualMarca {
  fontes: FonteMarca[];
  logo_url: string | null;
  fundo_padrao: string | null;
  paletas: string[];
  mood: string;
  tom_voz: string;
  evitar: string;
}

export const COMPOSICAO_VAZIA: Composicao = {
  formato: "feed",
  fundo: { cor: "#062e10", foto: null, listras: false },
  camadas: [],
};
