import { semTravessao } from "@/lib/blog/texto";

export interface PaginaGerada {
  titulo: string; meta_title: string; meta_description: string;
  conteudo_md: string; faq: { pergunta: string; resposta: string }[];
}

export function parsePaginaGerada(raw: Record<string, unknown> | null): PaginaGerada | null {
  if (!raw || typeof raw.titulo !== "string" || typeof raw.conteudo_md !== "string") return null;
  const titulo = semTravessao(raw.titulo.trim());
  if (!titulo) return null;
  const conteudo_md = semTravessao(String(raw.conteudo_md).trim());
  if (!conteudo_md) return null;
  const faqRaw = Array.isArray(raw.faq) ? raw.faq : [];
  const faq = faqRaw
    .map((f) => (f && typeof f === "object" ? f as Record<string, unknown> : {}))
    .filter((f) => typeof f.pergunta === "string" && typeof f.resposta === "string")
    .map((f) => ({ pergunta: semTravessao(String(f.pergunta).trim()), resposta: semTravessao(String(f.resposta).trim()) }))
    .slice(0, 6);
  return {
    titulo: titulo.slice(0, 160),
    meta_title: typeof raw.meta_title === "string" ? semTravessao(raw.meta_title.trim()).slice(0, 70) : titulo.slice(0, 70),
    meta_description: typeof raw.meta_description === "string" ? semTravessao(raw.meta_description.trim()).slice(0, 160) : "",
    conteudo_md, faq,
  };
}
