import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { getOrgPadrao } from "@/lib/seo/queries";
import { getCasePublicado } from "@/lib/seo/case-queries";
import { jsonLdCase } from "@/lib/seo/case-schema";
import { Markdown } from "@/components/blog/Markdown";

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

      <header className="mt-6">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-600">
          {c.segmento}
          {c.localidade ? ` · ${c.localidade}` : ""}
        </span>
        <h1 className="mt-2 text-4xl font-bold leading-[1.05] tracking-tight [font-family:var(--font-display)] sm:text-5xl">{c.cliente}</h1>
      </header>

      {c.cover_image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.cover_image_url} alt="" className="mt-7 aspect-[16/9] w-full rounded-2xl border border-neutral-200 object-cover" />
      )}

      {c.resultados.length > 0 && (
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {c.resultados.map((r, i) => (
            <div key={i} className="rounded-2xl border border-teal-100 bg-teal-50/40 p-5 text-center">
              <p className="text-3xl font-bold text-teal-700 [font-family:var(--font-display)]">{r.valor}</p>
              <p className="mt-1 text-sm text-neutral-600">{r.rotulo}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mx-auto mt-10 max-w-2xl">
        <Markdown light>{c.conteudo_md}</Markdown>
      </div>

      {c.depoimento_texto && (
        <blockquote className="mx-auto mt-10 max-w-2xl rounded-2xl border-l-4 border-teal-500 bg-white p-6">
          <p className="text-lg italic text-neutral-800">&ldquo;{c.depoimento_texto}&rdquo;</p>
          {c.depoimento_autor && <footer className="mt-2 text-sm font-semibold text-neutral-500">{c.depoimento_autor}</footer>}
        </blockquote>
      )}

      <div className="mx-auto mt-12 max-w-2xl rounded-2xl border border-neutral-200 bg-white p-7 text-center">
        <p className="text-xl font-bold [font-family:var(--font-display)]">Quer resultados assim?</p>
        <a
          href="https://wa.me/5565981447380"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-block rounded-full bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700"
        >
          Falar com a Yide
        </a>
      </div>
    </article>
  );
}
