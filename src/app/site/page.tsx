import type { Metadata } from "next";
import { getOrgPadrao, listServicosComPaginas } from "@/lib/seo/queries";
import { listCasesPublicados } from "@/lib/seo/case-queries";
import { getHomeConfig } from "@/lib/seo/home-queries";
import { HOME_DEFAULTS } from "@/lib/seo/home-config";
import { HomeYide } from "@/components/home/HomeYide";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Yide Digital · Marketing, tecnologia e IA",
  description: HOME_DEFAULTS.hero_sub,
  alternates: { canonical: "/" },
};

export default async function SitePage() {
  const orgId = await getOrgPadrao();
  const [config, servicos, cases] = await Promise.all([
    orgId ? getHomeConfig(orgId) : Promise.resolve(HOME_DEFAULTS),
    orgId ? listServicosComPaginas(orgId) : Promise.resolve([]),
    orgId ? listCasesPublicados(orgId) : Promise.resolve([]),
  ]);

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

  return <HomeYide data={{ config, servicos: servicosLimpos, cases: casesTop, depoimentos }} />;
}
