// SERVER — orquestra o pipeline: notícias → artigo+capa (IA) → rascunho no blog.
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { buscarNoticias, filtrarNovas, apenasRecentes } from "./rss";
import { gerarArtigo, gerarCapa } from "./gerar";
import { selecionarKeywordsAlvo } from "./keywords";
import { slugify, slugUnico } from "../slug";

export const BLOG_POSTS_POR_EXECUCAO = 3;
const DIAS_QUENTE = 5; // só notícias dos últimos N dias

export interface ResultadoPipeline {
  gerados: number;
  erros: number;
  semNovas: boolean;
}

export async function executarPipelineBlog(orgId: string, quantos = BLOG_POSTS_POR_EXECUCAO): Promise<ResultadoPipeline> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;

  const todas = await buscarNoticias();
  const noticias = apenasRecentes(todas, DIAS_QUENTE, Date.now()); // só as quentes
  if (noticias.length === 0) return { gerados: 0, erros: 0, semNovas: true };

  const [{ data: usadosData }, { data: slugsData }] = await Promise.all([
    sb.from("blog_posts").select("fonte_url").eq("organization_id", orgId).not("fonte_url", "is", null),
    sb.from("blog_posts").select("slug").eq("organization_id", orgId),
  ]);
  const usados = new Set(((usadosData ?? []) as Array<{ fonte_url: string }>).map((r) => r.fonte_url));
  const slugs = new Set(((slugsData ?? []) as Array<{ slug: string }>).map((r) => r.slug));

  const candidatas = filtrarNovas(noticias, usados).slice(0, quantos);
  if (candidatas.length === 0) return { gerados: 0, erros: 0, semNovas: true };

  let gerados = 0;
  let erros = 0;
  for (const n of candidatas) {
    const keywordsAlvo = selecionarKeywordsAlvo(4); // SEO local, varia por post
    const artigo = await gerarArtigo(n, keywordsAlvo);
    if (!artigo) { erros++; continue; }
    const capa = await gerarCapa(artigo.titulo); // best-effort (pode ficar sem capa)
    const slug = slugUnico(slugify(artigo.titulo), slugs);
    slugs.add(slug);
    // Garante que as keywords-alvo entrem nas keywords do post (dedup).
    const keywords = [...new Set([...artigo.keywords, ...keywordsAlvo])];
    const { error } = await sb.from("blog_posts").insert({
      organization_id: orgId,
      slug,
      titulo: artigo.titulo,
      resumo: artigo.resumo || null,
      conteudo_md: artigo.conteudo_md,
      cover_image_url: capa,
      status: "rascunho",
      keywords,
      meta_title: artigo.meta_title || null,
      meta_description: artigo.meta_description || null,
      fonte_url: n.link,
      fonte_nome: n.fonteNome,
      autor_id: null, // gerado pelo sistema (pipeline)
    });
    if (error) { console.error("[blog-pipeline] insert:", error.message); erros++; continue; }
    gerados++;
  }
  return { gerados, erros, semNovas: false };
}
