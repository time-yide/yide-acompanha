import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, MapPin, ArrowUpRight } from "lucide-react";
import { getOrgPadrao, getPaginaPublica } from "@/lib/seo/queries";
import { jsonLdServicoLocal } from "@/lib/seo/schema";
import { caminhoPagina } from "@/lib/seo/slug";
import { Markdown } from "@/components/blog/Markdown";
import { Faq } from "@/components/seo/Faq";
import { Reveal } from "@/components/site/Reveal";

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

      <Link href={`/servicos/${p.servicoSlug}`} className="inline-flex items-center gap-1 text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-900">
        <ArrowLeft className="h-4 w-4" /> {p.servicoNome}
      </Link>

      {/* Hero da localidade */}
      <header className="relative mt-6 overflow-hidden rounded-[2rem] border border-neutral-800 bg-neutral-950 px-7 py-14 text-white sm:px-14 sm:py-20">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-teal-500/20 blur-[120px]" />
          <div className="absolute -bottom-20 left-0 h-64 w-64 rounded-full bg-cyan-400/10 blur-[100px]" />
        </div>
        <div className="relative max-w-3xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300">
            <MapPin className="h-3.5 w-3.5" /> {p.localidadeNome} · {p.uf}
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight [font-family:var(--font-display)] sm:text-5xl">{p.titulo}</h1>
          <a href="https://wa.me/5565981447380" target="_blank" rel="noopener noreferrer"
            className="group mt-7 inline-flex items-center gap-2 rounded-full bg-teal-500 px-7 py-3 text-base font-semibold text-neutral-950 shadow-[0_8px_30px_rgba(45,230,230,0.25)] transition-all hover:bg-cyan-400 hover:shadow-[0_10px_40px_rgba(45,230,230,0.4)]">
            Solicitar proposta
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
        </div>
      </header>

      <Reveal className="mx-auto mt-12 max-w-2xl"><Markdown light>{p.conteudo_md}</Markdown></Reveal>

      {p.faq.length > 0 && (
        <Reveal as="section" className="mx-auto mt-14 max-w-2xl">
          <h2 className="mb-5 text-2xl font-bold tracking-tight [font-family:var(--font-display)]">Perguntas frequentes</h2>
          <Faq itens={p.faq} />
        </Reveal>
      )}

      {/* CTA final */}
      <Reveal as="section" className="mx-auto mt-14 max-w-3xl">
        <div className="relative overflow-hidden rounded-[2rem] bg-neutral-950 px-7 py-12 text-center text-white sm:px-12 sm:py-16">
          <div aria-hidden className="pointer-events-none absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-teal-500/20 blur-[100px]" />
          <div className="relative mx-auto max-w-xl">
            <p className="text-2xl font-extrabold [font-family:var(--font-display)] sm:text-3xl">Vamos crescer sua empresa em {p.localidadeNome}?</p>
            <p className="mt-3 text-white/65">A Yide Digital cuida do seu {p.servicoNome.toLowerCase()} de ponta a ponta.</p>
            <a href="https://wa.me/5565981447380" target="_blank" rel="noopener noreferrer"
              className="group mt-7 inline-flex items-center gap-2 rounded-full bg-teal-500 px-8 py-3.5 text-base font-semibold text-neutral-950 shadow-[0_8px_30px_rgba(45,230,230,0.25)] transition-all hover:bg-cyan-400 hover:shadow-[0_10px_40px_rgba(45,230,230,0.4)]">
              Falar com a Yide
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </div>
        </div>
      </Reveal>
    </article>
  );
}
