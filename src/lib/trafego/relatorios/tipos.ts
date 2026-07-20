// src/lib/trafego/relatorios/tipos.ts
//
// Tipos de slides do relatório de tráfego. Reusa os 6 templates do
// apresenta-yide e adiciona `grafico_barras` (SVG/HTML server-side).
// Mantemos os tipos AQUI (não em apresenta-yide/tipos.ts) pra não
// acoplar dois domínios distintos.

export type SlideTemplate =
  | "capa"
  | "conteudo"
  | "duas_colunas"
  | "metrica"
  | "topicos_numerados"
  | "grafico_barras"
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

export interface SlideGraficoBarras {
  template: "grafico_barras";
  titulo: string;
  subtitulo?: string;
  unidade: "moeda" | "numero" | "percentual";
  /** Máximo 7 itens — mais que isso fica ilegível no PDF. */
  dados: Array<{ label: string; valor: number }>;
  /** Insight curto abaixo do gráfico. */
  insight?: string;
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
  | SlideGraficoBarras
  | SlideEncerramento;

export interface Slide {
  template: SlideTemplate;
  content: SlideContent;
}

export type RelatorioStatus = "rascunho" | "gerando" | "pronta" | "erro";
export type FonteDados = "meta_api" | "manual" | "hibrido";

export interface RelatorioRow {
  id: string;
  cliente_id: string;
  organization_id: string;
  unit_id: string | null;
  periodo_inicio: string;
  periodo_fim: string;
  objetivo: string | null;
  fonte_dados: FonteDados;
  dados_meta: DadosTrafego | null;
  dados_manuais: DadosTrafego | null;
  slides: Slide[];
  status: RelatorioStatus;
  pdf_storage_path: string | null;
  publicado_em: string | null;
  criado_por: string | null;
  created_at: string;
}

/**
 * Shape dos dados brutos que alimentam o prompt da IA. Mesmas chaves
 * pra Meta API e form manual — facilita merge no fonte_dados=hibrido.
 */
export interface DadosTrafego {
  spend: number;
  impressoes?: number;
  alcance?: number;
  cliques?: number;
  cpc?: number;
  ctr?: number;
  conversoes?: number;
  custo_por_conversao?: number;
  leads?: number;
  custo_por_lead?: number;
  top_campanhas?: Array<{ nome: string; spend: number; resultados?: number }>;
  periodo_anterior?: {
    spend?: number;
    cliques?: number;
    conversoes?: number;
    leads?: number;
  };
  /**
   * Série diária do período pro gráfico de evolução (dashboard Reportei).
   * Guardada dentro do próprio `dados_meta` JSONB — sem migration.
   */
  serie_diaria?: Array<{ data: string; spend: number; resultados?: number }>;
}

// ─── Validação runtime ─────────────────────────────────────────────────

const TEMPLATES: readonly SlideTemplate[] = [
  "capa", "conteudo", "duas_colunas", "metrica",
  "topicos_numerados", "grafico_barras", "encerramento",
];

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}
function isStr(x: unknown): x is string { return typeof x === "string"; }
function isNonEmpty(x: unknown): x is string { return isStr(x) && x.trim().length > 0; }
function isNum(x: unknown): x is number { return typeof x === "number" && Number.isFinite(x); }

function isCapa(c: unknown): c is SlideCapa {
  if (!isObj(c) || c.template !== "capa") return false;
  if (!isNonEmpty(c.titulo)) return false;
  if (c.subtitulo !== undefined && !isStr(c.subtitulo)) return false;
  return true;
}
function isConteudo(c: unknown): c is SlideConteudo {
  if (!isObj(c) || c.template !== "conteudo") return false;
  if (!isNonEmpty(c.titulo)) return false;
  if (c.texto !== undefined && !isStr(c.texto)) return false;
  if (c.bullets !== undefined && (!Array.isArray(c.bullets) || !c.bullets.every(isStr))) return false;
  return true;
}
function isDuasColunas(c: unknown): c is SlideDuasColunas {
  if (!isObj(c) || c.template !== "duas_colunas") return false;
  if (!isNonEmpty(c.titulo)) return false;
  if (!isObj(c.coluna_esquerda) || !isStr(c.coluna_esquerda.titulo) || !isStr(c.coluna_esquerda.texto)) return false;
  if (!isObj(c.coluna_direita) || !isStr(c.coluna_direita.titulo) || !isStr(c.coluna_direita.texto)) return false;
  return true;
}
function isMetrica(c: unknown): c is SlideMetrica {
  if (!isObj(c) || c.template !== "metrica") return false;
  if (!isNonEmpty(c.numero) || !isNonEmpty(c.label)) return false;
  if (c.descricao !== undefined && !isStr(c.descricao)) return false;
  return true;
}
function isTopicos(c: unknown): c is SlideTopicosNumerados {
  if (!isObj(c) || c.template !== "topicos_numerados") return false;
  if (!isNonEmpty(c.titulo)) return false;
  if (!Array.isArray(c.topicos)) return false;
  return c.topicos.every((t) => isObj(t) && isNonEmpty(t.titulo));
}
function isGraficoBarras(c: unknown): c is SlideGraficoBarras {
  if (!isObj(c) || c.template !== "grafico_barras") return false;
  if (!isNonEmpty(c.titulo)) return false;
  if (c.subtitulo !== undefined && !isStr(c.subtitulo)) return false;
  if (!isStr(c.unidade) || !["moeda", "numero", "percentual"].includes(c.unidade)) return false;
  if (!Array.isArray(c.dados) || c.dados.length === 0 || c.dados.length > 7) return false;
  if (!c.dados.every((d) => isObj(d) && isNonEmpty(d.label) && isNum(d.valor))) return false;
  if (c.insight !== undefined && !isStr(c.insight)) return false;
  return true;
}
function isEncerramento(c: unknown): c is SlideEncerramento {
  if (!isObj(c) || c.template !== "encerramento") return false;
  if (!isNonEmpty(c.mensagem)) return false;
  if (c.cta !== undefined && !isStr(c.cta)) return false;
  return true;
}

export function isValidSlide(x: unknown): x is Slide {
  if (!isObj(x)) return false;
  if (!isStr(x.template) || !TEMPLATES.includes(x.template as SlideTemplate)) return false;
  if (!isObj(x.content) || x.content.template !== x.template) return false;
  switch (x.template as SlideTemplate) {
    case "capa": return isCapa(x.content);
    case "conteudo": return isConteudo(x.content);
    case "duas_colunas": return isDuasColunas(x.content);
    case "metrica": return isMetrica(x.content);
    case "topicos_numerados": return isTopicos(x.content);
    case "grafico_barras": return isGraficoBarras(x.content);
    case "encerramento": return isEncerramento(x.content);
  }
}

export function isValidSlides(x: unknown): x is Slide[] {
  return Array.isArray(x) && x.every(isValidSlide);
}
