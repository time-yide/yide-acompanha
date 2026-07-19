// SERVER — "Assuntos em alta": agrupa as notícias quentes em temas (via IA) e
// guarda um ranking pra guiar a criação de conteúdo. Também gera rascunho a partir de um tema.
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getAnthropicClient } from "@/lib/ai/client";
import { buscarNoticias, apenasRecentes, type NoticiaItem } from "./rss";
import { gerarArtigo, gerarCapa, extrairJson } from "./gerar";
import { selecionarKeywordsAlvo } from "./keywords";
import { slugify, slugUnico } from "../slug";

const BLOG_MODEL = "claude-haiku-4-5";
const DIAS_QUENTE = 5;
const MAX_TENDENCIAS = 8;

export interface TendenciaGerada {
  tema: string;
  motivo: string;
  angulo: string;
  fontes: number;
}

export interface Tendencia extends TendenciaGerada {
  posicao: number;
  atualizadoEm: string;
}

/** Monta o prompt de clusterização a partir das manchetes recentes (PURA, testável). */
export function montarPromptTendencias(noticias: NoticiaItem[]): string {
  const manchetes = noticias
    .map((n, i) => `${i + 1}. [${n.fonteNome}] ${n.titulo}`)
    .join("\n");
  return `Você é estrategista de conteúdo da Yide Digital, agência brasileira de marketing e programação. Abaixo estão manchetes recentes de fontes internacionais confiáveis (marketing, tecnologia e IA).

Agrupe-as em ATÉ ${MAX_TENDENCIAS} "assuntos em alta" (temas) relevantes pro público brasileiro de uma agência de marketing/tech. Ordene do mais quente pro menos quente (mais manchetes relacionadas + mais relevância = mais quente).

MANCHETES:
${manchetes}

Responda SOMENTE com um JSON válido (sem cercas de código, sem texto fora do JSON):
{"tendencias": [{"tema": "assunto curto em pt-br", "motivo": "por que está em alta, 1 frase", "angulo": "ângulo sugerido pra Yide escrever, conectando ao público e a marketing/programação (use SEO local de Cuiabá quando fizer sentido)", "fontes": 3}]}
O campo "fontes" é quantas manchetes da lista se relacionam ao tema (número inteiro).`;
}

/** Valida/normaliza a resposta da IA (PURA, testável). */
export function parseTendencias(raw: Record<string, unknown> | null): TendenciaGerada[] {
  if (!raw || !Array.isArray(raw.tendencias)) return [];
  const out: TendenciaGerada[] = [];
  for (const item of raw.tendencias as unknown[]) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const tema = typeof o.tema === "string" ? o.tema.trim() : "";
    if (!tema) continue;
    out.push({
      tema: tema.slice(0, 120),
      motivo: typeof o.motivo === "string" ? o.motivo.trim().slice(0, 240) : "",
      angulo: typeof o.angulo === "string" ? o.angulo.trim().slice(0, 300) : "",
      fontes: Number.isFinite(Number(o.fontes)) ? Math.max(0, Math.trunc(Number(o.fontes))) : 0,
    });
  }
  return out.slice(0, MAX_TENDENCIAS);
}

/** Recalcula o ranking de tendências e regrava (substitui o anterior da org). */
export async function gerarTendencias(orgId: string): Promise<{ ok: boolean; total: number }> {
  const client = getAnthropicClient();
  if (!client) { console.error("[blog-tendencias] Anthropic não configurado"); return { ok: false, total: 0 }; }

  const todas = await buscarNoticias();
  const noticias = apenasRecentes(todas, DIAS_QUENTE, Date.now());
  if (noticias.length === 0) return { ok: false, total: 0 };

  let itens: TendenciaGerada[] = [];
  try {
    const res = await client.messages.create({
      model: BLOG_MODEL,
      max_tokens: 2000,
      messages: [{ role: "user", content: montarPromptTendencias(noticias.slice(0, 30)) }],
    });
    const txt = res.content.map((c) => ("text" in c ? c.text : "")).join("").trim();
    itens = parseTendencias(extrairJson(txt));
  } catch (e) {
    console.error("[blog-tendencias] IA:", e);
    return { ok: false, total: 0 };
  }
  if (itens.length === 0) return { ok: false, total: 0 };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  await sb.from("blog_trending").delete().eq("organization_id", orgId);
  const rows = itens.map((t, i) => ({
    organization_id: orgId, posicao: i + 1,
    tema: t.tema, motivo: t.motivo, angulo: t.angulo, fontes: t.fontes,
  }));
  const { error } = await sb.from("blog_trending").insert(rows);
  if (error) { console.error("[blog-tendencias] insert:", error.message); return { ok: false, total: 0 }; }
  return { ok: true, total: rows.length };
}

/** Lê o ranking atual de tendências da org. */
export async function listarTendencias(orgId: string): Promise<{ itens: Tendencia[]; atualizadoEm: string | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data } = await sb.from("blog_trending")
    .select("posicao, tema, motivo, angulo, fontes, atualizado_em")
    .eq("organization_id", orgId).order("posicao", { ascending: true });
  const itens: Tendencia[] = (data ?? []).map((r: Record<string, unknown>) => ({
    posicao: Number(r.posicao), tema: String(r.tema), motivo: String(r.motivo ?? ""),
    angulo: String(r.angulo ?? ""), fontes: Number(r.fontes ?? 0), atualizadoEm: String(r.atualizado_em),
  }));
  return { itens, atualizadoEm: itens[0]?.atualizadoEm ?? null };
}

/** Gera um rascunho de post a partir de um tema do ranking. Retorna o id ou null. */
export async function gerarRascunhoDeTema(orgId: string, tema: string, angulo: string): Promise<string | null> {
  const keywordsAlvo = selecionarKeywordsAlvo(4);
  const noticia: NoticiaItem = {
    titulo: tema, link: "", resumo: angulo || tema, publicadoEm: null, fonteNome: "Tendências do setor",
  };
  const artigo = await gerarArtigo(noticia, keywordsAlvo);
  if (!artigo) return null;
  const capa = await gerarCapa(artigo.titulo);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data: slugsData } = await sb.from("blog_posts").select("slug").eq("organization_id", orgId);
  const slugs = new Set(((slugsData ?? []) as Array<{ slug: string }>).map((r) => r.slug));
  const slug = slugUnico(slugify(artigo.titulo), slugs);
  const keywords = [...new Set([...artigo.keywords, ...keywordsAlvo])];

  const { data, error } = await sb.from("blog_posts").insert({
    organization_id: orgId, slug, titulo: artigo.titulo, resumo: artigo.resumo || null,
    conteudo_md: artigo.conteudo_md, cover_image_url: capa, status: "rascunho", keywords,
    meta_title: artigo.meta_title || null, meta_description: artigo.meta_description || null,
    fonte_url: null, fonte_nome: null, autor_id: null,
  }).select("id").maybeSingle();
  if (error) { console.error("[blog-tendencias] gerarRascunhoDeTema insert:", error.message); return null; }
  return (data as { id: string } | null)?.id ?? null;
}
