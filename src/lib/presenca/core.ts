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

export function montarPromptPresenca(canal: Canal, tema: string, keywords: string[]): string {
  const kw = keywords.length ? `\nTrabalhe de forma NATURAL, quando couber, expressões de SEO local: ${keywords.join(", ")}.` : "";
  const temaTxt = tema.trim() ? `\nTema/assunto: ${tema.trim()}` : "\nEscolha um tema útil e atual sobre marketing, tecnologia ou os serviços da Yide.";
  const regra = "NUNCA use travessão nem meia-risca (use vírgula, dois-pontos, ponto ou parênteses).";
  if (canal === "gmn") {
    return `Você escreve para o Google Meu Negócio da Yide Digital (agência de marketing e programação, Cuiabá-MT). Escreva um POST curto (até ~1200 caracteres) em pt-br, com gancho local, valor pro cliente e um CTA claro. ${regra}${kw}${temaTxt}

Responda SOMENTE com JSON: {"conteudo": "texto do post", "hashtags": []}`;
  }
  return `Você escreve para o LinkedIn da Yide Digital (agência de marketing e programação, Cuiabá-MT). Escreva um POST profissional em pt-br (2 a 5 parágrafos curtos), tom de autoridade, com uma ideia útil e um CTA sutil. Ao final, sugira de 3 a 5 hashtags relevantes. ${regra}${kw}${temaTxt}

Responda SOMENTE com JSON: {"conteudo": "texto do post", "hashtags": ["#exemplo"]}`;
}
