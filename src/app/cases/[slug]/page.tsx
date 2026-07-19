import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { getOrgPadrao } from "@/lib/seo/queries";
import { getCasePublicado } from "@/lib/seo/case-queries";
import { jsonLdCase } from "@/lib/seo/case-schema";
import { Markdown } from "@/components/blog/Markdown";
import { Reveal } from "@/components/site/Reveal";

export const dynamic = "force-dynamic";

const SITE = "https://yidedigital.com.br";

async function carregar(slug: string) {
  const o = await getOrgPadrao();
  return o ? getCasePublicado(o, slug) : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = await carregar(slug);
  if (!c) return { title: "Case não encontrado · Yide Digital" };
  const title = c.meta_title || `${c.cliente} · Case Yide Digital`;
  return {
    title,
    description: c.meta_description || undefined,
    alternates: { canonical: `/cases/${c.slug}` },
    openGraph: { title, type: "article", images: c.cover_image_url ? [c.cover_image_url] : undefined },
  };
}

export default async function CasePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await carregar(slug);
  if (!c) notFound();

  const url = `${SITE}/cases/${c.slug}`;
  // JSON-LD: escapa `<` pra impedir quebra de </script>.
  const jsonldStr = JSON.stringify(
    jsonLdCase({
      titulo: c.meta_title || `${c.cliente} · Case`,
      descricao: c.meta_description || c.desafio,
      url,
      depoimentoTexto: c.depoimento_texto,
      depoimentoAutor: c.depoimento_autor,
    }),
  ).replace(/</g, "\\u003c");

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonldStr }} />

      <Link href="/cases" className="inline-flex items-center gap-1 text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-900">
        <ArrowLeft className="h-4 w-4" /> Cases
      </Link>

      {/* Hero */}
      <header className="relative mt-6 overflow-hidden rounded-[2rem] border border-neutral-800 bg-neutral-950 px-7 py-14 text-white sm:px-14 sm:py-20">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-teal-500/20 blur-[120px]" />
          <div className="absolute -bottom-20 left-0 h-64 w-64 rounded-full bg-cyan-400/10 blur-[100px]" />
        </div>
        <div className="relative max-w-3xl">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-400">
            {c.segmento}
            {c.localidade ? ` · ${c.localidade}` : ""}
          </span>
          <h1 className="mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight [font-family:var(--font-display)] sm:text-6xl">{c.cliente}</h1>
        </div>
      </header>

      {c.cover_image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.cover_image_url} alt="" className="mt-7 aspect-[16/9] w-full rounded-[1.75rem] border border-neutral-200 object-cover" />
      )}

      {c.resultados.length > 0 && (
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {c.resultados.map((r, i) => (
            <Reveal key={i} delay={i * 90}>
              <div className="group h-full overflow-hidden rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50/70 to-white p-6 text-center transition-all hover:-translate-y-1 hover:border-teal-300 hover:shadow-[0_16px_40px_-20px_rgba(13,148,136,0.35)]">
                <p className="text-4xl font-extrabold text-teal-600 [font-family:var(--font-display)]">{r.valor}</p>
                <p className="mt-2 text-sm text-neutral-600">{r.rotulo}</p>
              </div>
            </Reveal>
          ))}
        </div>
      )}

      <Reveal className="mx-auto mt-12 max-w-2xl">
        <Markdown light>{c.conteudo_md}</Markdown>
      </Reveal>

      {c.depoimento_texto && (
        <Reveal className="mx-auto mt-12 max-w-2xl">
          <blockquote className="relative overflow-hidden rounded-[1.75rem] border border-neutral-200 bg-white p-8 shadow-sm sm:p-10">
            <span aria-hidden className="absolute left-6 top-2 text-7xl font-black leading-none text-teal-500/15 [font-family:var(--font-display)]">&ldquo;</span>
            <p className="relative text-lg italic leading-relaxed text-neutral-800 sm:text-xl">&ldquo;{c.depoimento_texto}&rdquo;</p>
            {c.depoimento_autor && <footer className="relative mt-4 text-sm font-semibold text-teal-700">— {c.depoimento_autor}</footer>}
          </blockquote>
        </Reveal>
      )}

      {/* CTA final */}
      <Reveal as="section" className="mx-auto mt-14 max-w-3xl">
        <div className="relative overflow-hidden rounded-[2rem] bg-neutral-950 px-7 py-12 text-center text-white sm:px-12 sm:py-16">
          <div aria-hidden className="pointer-events-none absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-teal-500/20 blur-[100px]" />
          <div className="relative mx-auto max-w-xl">
            <p className="text-2xl font-extrabold [font-family:var(--font-display)] sm:text-3xl">Quer resultados assim?</p>
            <p className="mt-3 text-white/65">Fale com a Yide Digital e comece a crescer sua empresa.</p>
            <a
              href="https://wa.me/5565981447380"
              target="_blank"
              rel="noopener noreferrer"
              className="group mt-7 inline-flex items-center gap-2 rounded-full bg-teal-500 px-8 py-3.5 text-base font-semibold text-neutral-950 shadow-[0_8px_30px_rgba(45,230,230,0.25)] transition-all hover:bg-cyan-400 hover:shadow-[0_10px_40px_rgba(45,230,230,0.4)]"
            >
              Falar com a Yide
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </div>
        </div>
      </Reveal>
    </article>
  );
}
