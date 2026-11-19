import type { Metadata } from "next";
import { getOrgPadrao, listServicosOuSeed } from "@/lib/seo/queries";
import { listCasesPublicados } from "@/lib/seo/case-queries";
import { CASES_ESTATICOS } from "@/lib/site/cases-estaticos";
import { getHomeConfig } from "@/lib/seo/home-queries";
import { HOME_DEFAULTS } from "@/lib/seo/home-config";
import { HomeYide } from "@/components/home/HomeYide";
import { getOrgPadraoBlog, listPostsPublicados } from "@/lib/blog/queries";
import { separarPosts } from "@/lib/blog/temas-empresario";
import { FAQ_LOCAL } from "@/lib/site/faq-local";

// FAQ da seção "Agência de marketing em Cuiabá" como dado estruturado (rich result e IAs).
const FAQ_LOCAL_JSONLD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_LOCAL.map((f) => ({
    "@type": "Question",
    name: f.pergunta,
    acceptedAnswer: { "@type": "Answer", text: f.resposta },
  })),
}).replace(/</g, "\\u003c");

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Agência de Marketing em Cuiabá | Marketing, Vendas e IA · Yide Digital",
  description: "Agência de marketing, vendas e IA em Cuiabá: tráfego pago, CRM com IA, vídeos, redes sociais, sites, e-commerce e Mercado Livre. Atende todo o Brasil.",
  alternates: { canonical: "/" },
};

export default async function SitePage() {
  const orgId = await getOrgPadrao();
  const [config, servicos, cases] = await Promise.all([
    orgId ? getHomeConfig(orgId) : Promise.resolve(HOME_DEFAULTS),
    listServicosOuSeed(orgId),
    orgId ? listCasesPublicados(orgId) : Promise.resolve(CASES_ESTATICOS),
  ]);
  const orgBlog = await getOrgPadraoBlog();
  const todosPosts = orgBlog ? await listPostsPublicados(orgBlog) : [];
  // Só artigo do empresário (estratégico) na home: notícia de mercado fica no blog.
  const posts = separarPosts(todosPosts.filter((p) => !p.fonte_url)).doEmpresario.slice(0, 3)
    .map((p) => ({ slug: p.slug, titulo: p.titulo, resumo: p.resumo, cover_image_url: p.cover_image_url }));

  const servicosLimpos = servicos.map((s) => ({
    id: s.id,
    nome: s.nome,
    slug: s.slug,
    descricao_base: s.descricao_base,
  }));
  const casesTop = cases.slice(0, 3).map((c) => ({
    slug: c.slug,
    cliente: c.cliente,
    segmento: c.segmento,
    resultados: c.resultados,
    cover_image_url: c.cover_image_url,
  }));
  const depoimentos = cases
    .filter((c) => c.depoimento_texto && c.depoimento_texto.trim())
    .slice(0, 6)
    .map((c) => ({ texto: c.depoimento_texto, autor: c.depoimento_autor, cliente: c.cliente }));

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: FAQ_LOCAL_JSONLD }} />
      <HomeYide data={{ config, servicos: servicosLimpos, cases: casesTop, depoimentos, posts }} />
    </>
  );
}
