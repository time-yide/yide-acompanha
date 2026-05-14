/**
 * Tipos compartilhados do módulo Design.
 *
 * IMPORTANTE: na Fase 1 não temos integração com IA — todas as artes são
 * cadastradas manualmente (upload). A Fase 2 vai conectar OpenAI (GPT-Image-1
 * / DALL-E 3), Google (Imagen 3/4), e provavelmente Flux Pro / Ideogram.
 *
 * Claude (Anthropic) NÃO gera imagens — só análise visual / texto. Por isso
 * não está na lista de provedores.
 */

export const FORMATOS = [
  { value: "feed",      label: "Feed (1080×1080)",        ratio: "1:1" },
  { value: "story",     label: "Story (1080×1920)",       ratio: "9:16" },
  { value: "carrossel", label: "Carrossel (múltiplas imagens)", ratio: "1:1" },
  { value: "reels",     label: "Reels (vertical)",        ratio: "9:16" },
  { value: "outro",     label: "Outro",                   ratio: "" },
] as const;

export type Formato = (typeof FORMATOS)[number]["value"];

export const STATUS_DEFS: Record<string, { label: string; color: string }> = {
  rascunho: {
    label: "Rascunho",
    color: "border-muted-foreground/30 text-muted-foreground",
  },
  em_producao: {
    label: "Em produção",
    color: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  },
  aguardando_aprovacao: {
    label: "Aguardando cliente",
    color: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  aprovado: {
    label: "Aprovado",
    color: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  ajustes_solicitados: {
    label: "Ajustes pedidos",
    color: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  },
  agendado: {
    label: "Agendado",
    color: "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
  publicado: {
    label: "Publicado",
    color: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
};

export const STATUS_VALORES = [
  "rascunho",
  "em_producao",
  "aguardando_aprovacao",
  "aprovado",
  "ajustes_solicitados",
  "agendado",
  "publicado",
] as const;

/**
 * Provedores de IA pra geração de imagem.
 * Fase 1: todos disabled (mostra "Em breve").
 * Fase 2: ativa conforme env vars (OPENAI_API_KEY, GOOGLE_AI_API_KEY, etc.)
 */
export interface IaProvider {
  value: string;
  label: string;
  /** Modelo padrão sugerido. */
  modeloPadrao: string;
  /** Pra que esse provedor é melhor. */
  melhorPara: string;
  /** Quando true, o botão fica desabilitado e mostra "Em breve". */
  comingSoon?: boolean;
}

export const IA_PROVIDERS: IaProvider[] = [
  {
    value: "ia_openai",
    label: "ChatGPT (GPT-Image-1)",
    modeloPadrao: "gpt-image-1",
    melhorPara: "Geral, criativo, bom com texto em imagens",
    comingSoon: true,
  },
  {
    value: "ia_gemini",
    label: "Gemini (Imagen 4)",
    modeloPadrao: "imagen-4",
    melhorPara: "Foto-realismo, qualidade muito alta",
    comingSoon: true,
  },
  {
    value: "ia_flux",
    label: "Flux Pro (BFL)",
    modeloPadrao: "flux-pro-1.1",
    melhorPara: "Foto-realismo profissional, mãos/rostos perfeitos",
    comingSoon: true,
  },
  {
    value: "ia_ideogram",
    label: "Ideogram",
    modeloPadrao: "ideogram-v2",
    melhorPara: "Posts com texto/copy embutido (logos, social media)",
    comingSoon: true,
  },
];

/**
 * Style guide do cliente — JSONB livre, mas com estrutura sugerida.
 * Persistido em clients.design_style_guide.
 */
export interface StyleGuide {
  paletas?: string[];          // hex colors
  fontes_titulos?: string[];
  fontes_corpo?: string[];
  mood?: string;               // ex: "Minimalista, alto contraste"
  tom_voz?: string;            // ex: "Direto, profissional"
  referencias?: string[];      // URLs de referência
  evitar?: string;             // ex: "Não usar tons de marrom"
  marca?: string;              // ex: "Logo branco no canto inferior"
  exemplos_aprovados?: string[]; // URLs de artes anteriores aprovadas
}

export const STYLE_GUIDE_VAZIO: StyleGuide = {
  paletas: [],
  fontes_titulos: [],
  fontes_corpo: [],
  mood: "",
  tom_voz: "",
  referencias: [],
  evitar: "",
  marca: "",
  exemplos_aprovados: [],
};
