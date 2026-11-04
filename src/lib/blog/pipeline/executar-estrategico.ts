// SERVER — pipeline de conteúdo ESTRATÉGICO: pega temas ainda não usados →
// artigo+FAQ+capa (IA) → rascunho no blog (tipo "estrategico", sem fonte).
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { gerarArtigoEstrategico } from "./estrategico";
import { buscarImagemStock } from "./stock-image";
import { camposDePublicacao } from "./publicacao";
import { selecionarKeywordsAlvo } from "./keywords";
import { TEMAS_ESTRATEGICOS, slugDoTema } from "./temas-estrategicos";
import { slugUnico } from "../slug";

export interface ResultadoPipelineEstrategico {
  gerados: number;
  erros: number;
  publicados: string[]; // slugs que foram pro ar
}

export async function executarPipelineEstrategico(orgId: string, quantos = 1, publicar = false): Promise<ResultadoPipelineEstrategico> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;

  const { data: slugsData } = await sb.from("blog_posts").select("slug").eq("organization_id", orgId);
  const slugs = new Set(((slugsData ?? []) as Array<{ slug: string }>).map((r) => r.slug));

  // Temas cujo slug ainda não existe no blog da org.
  const temasNaoUsados = TEMAS_ESTRATEGICOS.filter((t) => !slugs.has(slugDoTema(t.pergunta))).slice(0, quantos);
  if (temasNaoUsados.length === 0) return { gerados: 0, erros: 0, publicados: [] };

  let gerados = 0;
  let erros = 0;
  const publicados: string[] = [];
  for (const tema of temasNaoUsados) {
    try {
      const keywordsAlvo = selecionarKeywordsAlvo(4); // SEO local, varia por post
      const artigo = await gerarArtigoEstrategico(tema.pergunta, keywordsAlvo);
      if (!artigo) { erros++; continue; }
      const capa = await buscarImagemStock(artigo.keywords);
      const slug = slugUnico(slugDoTema(tema.pergunta), slugs);
      slugs.add(slug);
      // Garante que as keywords-alvo entrem nas keywords do post (dedup).
      const keywords = [...new Set([...artigo.keywords, ...keywordsAlvo])];
      const publicacao = camposDePublicacao(artigo.conteudo_md, publicar, new Date().toISOString());
      const { error } = await sb.from("blog_posts").insert({
        organization_id: orgId,
        slug,
        titulo: artigo.titulo,
        resumo: artigo.resumo || null,
        conteudo_md: artigo.conteudo_md,
        cover_image_url: capa,
        ...publicacao,
        tipo: "estrategico",
        faq: artigo.faq,
        keywords,
        meta_title: artigo.meta_title || null,
        meta_description: artigo.meta_description || null,
        autor_id: null, // gerado pelo sistema (pipeline)
      });
      if (error) { console.error("[blog-estrategico] insert:", error.message); erros++; continue; }
      gerados++;
      if (publicacao.status === "publicado") publicados.push(slug);
    } catch (e) {
      console.error("[blog-estrategico] pipeline item:", e);
      erros++;
    }
  }
  return { gerados, erros, publicados };
}
