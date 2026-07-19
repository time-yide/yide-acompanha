import { semTravessao } from "@/lib/blog/texto";
import type { Canal, ItemChecklist } from "./config";

export function progressoChecklist(itens: ItemChecklist[], feitos: string[]): { feitos: number; total: number; pct: number } {
  const set = new Set(feitos);
  const n = itens.filter((i) => set.has(i.key)).length;
  const total = itens.length;
  return { feitos: n, total, pct: total ? Math.round((n / total) * 100) : 0 };
}

export interface PostPresenca { conteudo: string; hashtags: string[] }
export function parsePostPresenca(raw: Record<string, unknown> | null): PostPresenca | null {
  if (!raw || typeof raw.conteudo !== "string") return null;
  const conteudo = semTravessao(raw.conteudo.trim());
  if (!conteudo) return null;
  const hashtags = Array.isArray(raw.hashtags)
    ? raw.hashtags.filter((h): h is string => typeof h === "string" && h.trim() !== "").map((h) => (h.startsWith("#") ? h : `#${h}`)).slice(0, 5)
    : [];
  return { conteudo, hashtags };
}

interface PromptCanal { nome: string; formato: string; hashtags: boolean }

const PROMPT_CANAL: Record<Canal, PromptCanal> = {
  gmn: {
    nome: "Google Meu Negócio",
    formato: "Escreva um POST curto (até ~1200 caracteres) em pt-br, com gancho local, valor pro cliente e um CTA claro.",
    hashtags: false,
  },
  linkedin: {
    nome: "LinkedIn",
    formato: "Escreva um POST profissional em pt-br (2 a 5 parágrafos curtos), tom de autoridade, com uma ideia útil e um CTA sutil. Ao final, sugira de 3 a 5 hashtags relevantes.",
    hashtags: true,
  },
  instagram: {
    nome: "Instagram",
    formato: "Escreva a LEGENDA de um post ou reels em pt-br, com um gancho forte na primeira linha, valor pro cliente e um CTA claro. Ao final, sugira de 3 a 5 hashtags misturando locais e do nicho.",
    hashtags: true,
  },
  tiktok: {
    nome: "TikTok",
    formato: "Escreva um roteiro curto (ou legenda) de vídeo em pt-br, tom leve e direto, com um gancho no início e uma dica prática. Ao final, sugira de 3 a 5 hashtags.",
    hashtags: true,
  },
  youtube: {
    nome: "YouTube",
    formato: "Escreva o TÍTULO e a DESCRIÇÃO de um vídeo how-to em pt-br. Use palavras-chave no título e na descrição e feche com um CTA pro site. No campo conteudo, comece com 'Título: ...' e depois a descrição.",
    hashtags: false,
  },
  threads: {
    nome: "Threads",
    formato: "Escreva um post curto de opinião ou dica em pt-br, tom conversacional e direto. Use poucas hashtags (no máximo 2), só se agregarem.",
    hashtags: true,
  },
  facebook: {
    nome: "Facebook",
    formato: "Escreva um post informativo com apelo local em pt-br, com valor pro cliente e um CTA claro. Use poucas hashtags (no máximo 2).",
    hashtags: true,
  },
  pinterest: {
    nome: "Pinterest",
    formato: "Escreva o TÍTULO e a DESCRIÇÃO de um Pin em pt-br, com palavras-chave, pensado pra levar o clique pro blog ou site. No campo conteudo, comece com 'Título: ...' e depois a descrição.",
    hashtags: false,
  },
  medium: {
    nome: "Medium",
    formato: "Escreva a abertura de um mini-artigo em pt-br (título e primeiros parágrafos), tom de autoridade, com valor real pro leitor e um CTA pro site no fim.",
    hashtags: false,
  },
};

export function montarPromptPresenca(canal: Canal, tema: string, keywords: string[]): string {
  const kw = keywords.length ? `\nTrabalhe de forma NATURAL, quando couber, expressões de SEO local: ${keywords.join(", ")}.` : "";
  const temaTxt = tema.trim() ? `\nTema/assunto: ${tema.trim()}` : "\nEscolha um tema útil e atual sobre marketing, tecnologia ou os serviços da Yide.";
  const regra = "NUNCA use travessão nem meia-risca (use vírgula, dois-pontos, ponto ou parênteses).";
  const cfg = PROMPT_CANAL[canal];
  const jsonHashtags = cfg.hashtags ? `["#exemplo"]` : `[]`;
  return `Você escreve para o ${cfg.nome} da Yide Digital (agência de marketing e programação, Cuiabá-MT). ${cfg.formato} ${regra}${kw}${temaTxt}

Responda SOMENTE com JSON: {"conteudo": "texto do post", "hashtags": ${jsonHashtags}}`;
}
