import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, MapPin } from "lucide-react";
import { getOrgPadrao, getPaginaPublica } from "@/lib/seo/queries";
import { jsonLdServicoLocal } from "@/lib/seo/schema";
import { caminhoPagina } from "@/lib/seo/slug";
import { Markdown } from "@/components/blog/Markdown";
import { Faq } from "@/components/seo/Faq";

export const dynamic = "force-dynamic";
const SITE = "https://yidedigital.com.br";

async function carregar(servico: string, localidade: string) {
  const orgId = await getOrgPadrao();
  return orgId ? getPaginaPublica(orgId, servico, localidade) : null;
}
export async function generateMetadata({ params }: { params: Promise<{ servico: string; localidade: string }> }): Promise<Metadata> {
  const { servico, localidade } = await params;
  const p = await carregar(servico, localidade);
  if (!p) return { title: "Página não encontrada · Yide Digital" };
  const title = p.meta_title || `${p.servicoNome} em ${p.localidadeNome} · Yide Digital`;
  return { title, description: p.meta_description || undefined,
    alternates: { canonical: caminhoPagina(p.servicoSlug, p.localidadeSlug) },
    openGraph: { title, description: p.meta_description || undefined, type: "website" } };
}
export default async function PaginaServicoLocal({ params }: { params: Promise<{ servico: string; localidade: string }> }) {
  const { servico, localidade } = await params;
  const p = await carregar(servico, localidade);
  if (!p) notFound();
  const url = `${SITE}${caminhoPagina(p.servicoSlug, p.localidadeSlug)}`;
  // JSON-LD: escapa `<` pra impedir quebra de </script>. Conteúdo é 100% da nossa
  // função jsonLdServicoLocal (sem entrada externa), mesmo padrão do post do blog.
  const jsonld = JSON.stringify(jsonLdServicoLocal({ servicoNome: p.servicoNome, descricao: p.meta_description || p.titulo, url,
    localidadeNome: p.localidadeNome, tipo: p.tipo, uf: p.uf, faq: p.faq })).replace(/</g, "\\u003c");
  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonld }} />

      <Link href={`/servicos/${p.servicoSlug}`} className="inline-flex items-center gap-1 text-sm font-medium text-neutral-500 hover:text-neutral-900">
        <ArrowLeft className="h-4 w-4" /> {p.servicoNome}
      </Link>
      <header className="relative mt-6 overflow-hidden rounded-[1.75rem] border border-teal-100/80 bg-gradient-to-br from-teal-50 via-cyan-50/50 to-[#faf9f7] px-7 py-12 sm:px-12 sm:py-16">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-teal-400/15 blur-3xl" />
        <p className="relative inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-600">
          <MapPin className="h-3.5 w-3.5" /> {p.localidadeNome} · {p.uf}</p>
        <h1 className="relative mt-3 max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight [font-family:var(--font-display)] sm:text-5xl">{p.titulo}</h1>
        <a href="https://wa.me/5565981447380" target="_blank" rel="noopener noreferrer"
          className="relative mt-6 inline-block rounded-full bg-teal-600 px-6 py-3 text-sm font-semibold text-white hover:bg-teal-700">Solicitar proposta</a>
      </header>
      <div className="mx-auto mt-10 max-w-2xl"><Markdown light>{p.conteudo_md}</Markdown></div>
      {p.faq.length > 0 && (
        <section className="mx-auto mt-12 max-w-2xl">
          <h2 className="mb-4 text-2xl font-bold tracking-tight [font-family:var(--font-display)]">Perguntas frequentes</h2>
          <Faq itens={p.faq} />
        </section>
      )}
      <div className="mx-auto mt-12 max-w-2xl rounded-2xl border border-neutral-200 bg-white p-7 text-center">
        <p className="text-xl font-bold [font-family:var(--font-display)]">Vamos crescer sua empresa em {p.localidadeNome}?</p>
        <p className="mt-1 text-sm text-neutral-600">A Yide Digital cuida do seu {p.servicoNome.toLowerCase()} de ponta a ponta.</p>
        <a href="https://wa.me/5565981447380" target="_blank" rel="noopener noreferrer"
          className="mt-4 inline-block rounded-full bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-teal-700">Falar com a Yide</a>
      </div>
    </article>
  );
}
