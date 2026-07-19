// SERVER — geração de artigo (Claude) + capa (gpt-image-1) a partir de uma notícia.
import { getAnthropicClient } from "@/lib/ai/client";
import { gerarImagemOpenAI } from "@/lib/design/image-gen/openai";
import { uploadCapaBlog } from "./storage";
import type { NoticiaItem } from "./rss";

const BLOG_MODEL = "claude-haiku-4-5";

export interface ArtigoGerado {
  titulo: string;
  resumo: string;
  conteudo_md: string;
  keywords: string[];
}

/** Extrai o 1º objeto JSON de um texto (tolera cercas de código e texto ao redor). */
export function extrairJson(txt: string): Record<string, unknown> | null {
  const clean = txt.replace(/```json/gi, "").replace(/```/g, "");
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(clean.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Claude escreve um artigo ORIGINAL em PT a partir da notícia (não copia/traduz). */
export async function gerarArtigo(noticia: NoticiaItem): Promise<ArtigoGerado | null> {
  const client = getAnthropicClient();
  if (!client) { console.error("[blog-pipeline] Anthropic não configurado"); return null; }

  const prompt = `Você é redator(a) da Yide Digital, uma agência de marketing brasileira. A partir da notícia abaixo (fonte internacional), escreva um artigo de blog ORIGINAL em português brasileiro. NÃO copie nem traduza literalmente: produza sua própria análise, com contexto e implicações pro mercado brasileiro de marketing, tecnologia e IA. Tom informativo e acessível, evitando jargão. Cite a fonte no corpo quando fizer sentido.

NOTÍCIA (fonte: ${noticia.fonteNome})
Título: ${noticia.titulo}
Resumo: ${noticia.resumo}
Link: ${noticia.link}

Responda SOMENTE com um JSON válido (sem cercas de código, sem texto fora do JSON):
{"titulo": "título chamativo em pt-br", "resumo": "1-2 frases de resumo", "conteudo_md": "artigo em markdown, 400-700 palavras, com subtítulos usando ##", "keywords": ["3 a 6 palavras-chave em pt-br"]}`;

  try {
    const res = await client.messages.create({
      model: BLOG_MODEL,
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    });
    const txt = res.content.map((c) => ("text" in c ? c.text : "")).join("").trim();
    const json = extrairJson(txt);
    if (!json || typeof json.titulo !== "string" || typeof json.conteudo_md !== "string") return null;
    return {
      titulo: String(json.titulo).trim(),
      resumo: json.resumo != null ? String(json.resumo).trim() : "",
      conteudo_md: String(json.conteudo_md).trim(),
      keywords: Array.isArray(json.keywords) ? json.keywords.map((k) => String(k).trim()).filter(Boolean).slice(0, 6) : [],
    };
  } catch (e) {
    console.error("[blog-pipeline] gerarArtigo:", e);
    return null;
  }
}

/** Gera uma capa ilustrativa (sem texto) e devolve a URL pública, ou null. */
export async function gerarCapa(titulo: string): Promise<string | null> {
  const prompt = `Ilustração de capa de blog, estilo editorial moderno, limpo e conceitual, sobre o tema: "${titulo}". Paleta em tons de teal/ciano e violeta. Sem nenhum texto ou letra na imagem. Composição abstrata e profissional.`;
  const r = await gerarImagemOpenAI({ prompt, size: "1536x1024", quality: "low" });
  if (!r.ok || !r.b64) { console.error("[blog-pipeline] gerarCapa:", r.error); return null; }
  return uploadCapaBlog(r.b64);
}
