// Tipos compartilhados entre client/server. Pure types, sem deps de runtime.

export type SlideTemplate =
  | "capa"
  | "conteudo"
  | "duas_colunas"
  | "metrica"
  | "topicos_numerados"
  | "encerramento";

export interface SlideCapa {
  template: "capa";
  titulo: string;
  subtitulo?: string;
}

export interface SlideConteudo {
  template: "conteudo";
  titulo: string;
  texto?: string;
  bullets?: string[];
}

export interface SlideDuasColunas {
  template: "duas_colunas";
  titulo: string;
  coluna_esquerda: { titulo: string; texto: string };
  coluna_direita: { titulo: string; texto: string };
}

export interface SlideMetrica {
  template: "metrica";
  numero: string;
  label: string;
  descricao?: string;
}

export interface SlideTopicosNumerados {
  template: "topicos_numerados";
  titulo: string;
  topicos: Array<{ titulo: string; texto?: string }>;
}

export interface SlideEncerramento {
  template: "encerramento";
  mensagem: string;
  cta?: string;
}

export type SlideContent =
  | SlideCapa
  | SlideConteudo
  | SlideDuasColunas
  | SlideMetrica
  | SlideTopicosNumerados
  | SlideEncerramento;

export interface Slide {
  template: SlideTemplate;
  content: SlideContent;
}

export type ApresentacaoStatus = "rascunho" | "gerando" | "pronta" | "erro";

export interface ApresentacaoRow {
  id: string;
  titulo: string;
  prompt: string;
  objetivo: string | null;
  num_slides_alvo: number;
  slides: Slide[];
  status: ApresentacaoStatus;
  pdf_storage_path: string | null;
  criado_por: string;
  criado_por_nome: string | null;
  created_at: string;
}

// ─── Validação runtime ─────────────────────────────────────────────────

const TEMPLATES: readonly SlideTemplate[] = [
  "capa", "conteudo", "duas_colunas", "metrica", "topicos_numerados", "encerramento",
];

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function isStr(x: unknown): x is string {
  return typeof x === "string";
}

function isStrNonEmpty(x: unknown): x is string {
  return isStr(x) && x.trim().length > 0;
}

function isCapa(c: unknown): c is SlideCapa {
  if (!isObj(c) || c.template !== "capa") return false;
  if (!isStrNonEmpty(c.titulo)) return false;
  if (c.subtitulo !== undefined && !isStr(c.subtitulo)) return false;
  return true;
}

function isConteudo(c: unknown): c is SlideConteudo {
  if (!isObj(c) || c.template !== "conteudo") return false;
  if (!isStrNonEmpty(c.titulo)) return false;
  if (c.texto !== undefined && !isStr(c.texto)) return false;
  if (c.bullets !== undefined) {
    if (!Array.isArray(c.bullets) || !c.bullets.every(isStr)) return false;
  }
  return true;
}

function isDuasColunas(c: unknown): c is SlideDuasColunas {
  if (!isObj(c) || c.template !== "duas_colunas") return false;
  if (!isStrNonEmpty(c.titulo)) return false;
  if (!isObj(c.coluna_esquerda) || !isStr(c.coluna_esquerda.titulo) || !isStr(c.coluna_esquerda.texto)) return false;
  if (!isObj(c.coluna_direita) || !isStr(c.coluna_direita.titulo) || !isStr(c.coluna_direita.texto)) return false;
  return true;
}

function isMetrica(c: unknown): c is SlideMetrica {
  if (!isObj(c) || c.template !== "metrica") return false;
  if (!isStrNonEmpty(c.numero) || !isStrNonEmpty(c.label)) return false;
  if (c.descricao !== undefined && !isStr(c.descricao)) return false;
  return true;
}

function isTopicosNumerados(c: unknown): c is SlideTopicosNumerados {
  if (!isObj(c) || c.template !== "topicos_numerados") return false;
  if (!isStrNonEmpty(c.titulo)) return false;
  if (!Array.isArray(c.topicos)) return false;
  return c.topicos.every((t) => isObj(t) && isStrNonEmpty(t.titulo));
}

function isEncerramento(c: unknown): c is SlideEncerramento {
  if (!isObj(c) || c.template !== "encerramento") return false;
  if (!isStrNonEmpty(c.mensagem)) return false;
  if (c.cta !== undefined && !isStr(c.cta)) return false;
  return true;
}

export function isValidSlide(x: unknown): x is Slide {
  if (!isObj(x)) return false;
  if (!isStr(x.template) || !TEMPLATES.includes(x.template as SlideTemplate)) return false;
  if (!isObj(x.content) || x.content.template !== x.template) return false;
  switch (x.template) {
    case "capa": return isCapa(x.content);
    case "conteudo": return isConteudo(x.content);
    case "duas_colunas": return isDuasColunas(x.content);
    case "metrica": return isMetrica(x.content);
    case "topicos_numerados": return isTopicosNumerados(x.content);
    case "encerramento": return isEncerramento(x.content);
  }
}

export function isValidApresentacaoSlides(x: unknown): x is Slide[] {
  if (!Array.isArray(x)) return false;
  return x.every(isValidSlide);
}
