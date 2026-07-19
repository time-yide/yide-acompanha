import Link from "next/link";
import type { Metadata } from "next";
import { getOrgPadraoBlog, listPostsPublicados, type BlogPostPublic } from "@/lib/blog/queries";
import { tempoLeituraMin } from "@/lib/blog/leitura";

// Dinâmica (não pré-renderiza no build): usa service-role, cuja env só existe em runtime.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog · Yide Digital",
  description: "Marketing, tecnologia e inteligência artificial: o que importa, direto ao ponto, pela Yide Digital.",
  alternates: { canonical: "/blog" },
  openGraph: { title: "Blog · Yide Digital", description: "Marketing, tecnologia e IA.", type: "website" },
};

function fmtData(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-teal-600/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-teal-700">
      {children}
    </span>
  );
}

function Meta({ post }: { post: BlogPostPublic }) {
  return (
    <span className="text-xs text-neutral-400">
      {fmtData(post.published_at)} · {tempoLeituraMin(post.conteudo_md)} min de leitura
    </span>
  );
}

export default async function BlogIndex() {
  const orgId = await getOrgPadraoBlog();
  const posts = orgId ? await listPostsPublicados(orgId) : [];
  const [destaque, ...resto] = posts;

  return (
    <div className="space-y-14">
      {/* Hero */}
      <header className="relative overflow-hidden rounded-[1.75rem] border border-teal-100/70 bg-gradient-to-br from-teal-50 via-white to-cyan-50/40 px-7 py-16 shadow-sm sm:px-14 sm:py-24">
        <div className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full bg-teal-400/20 blur-[110px]" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-cyan-300/20 blur-[110px]" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/logo-yide.png"
          alt=""
          aria-hidden
          className="pointer-events-none absolute -bottom-12 -right-8 w-60 select-none opacity-[0.06] sm:w-96"
        />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-teal-200/80 bg-white/70 px-3.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700 backdrop-blur">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-500" />
            Blog da Yide Digital
          </span>
          <h1 className="mt-5 text-6xl font-bold leading-[0.95] tracking-tight [font-family:var(--font-display)] sm:text-8xl">Novidades</h1>
          <div className="mt-5 h-1 w-24 rounded-full bg-gradient-to-r from-teal-500 to-cyan-400" />
          <p className="mt-5 max-w-lg text-base leading-relaxed text-neutral-600 sm:text-lg">
            Marketing, tecnologia e inteligência artificial: o que importa, direto ao ponto.
          </p>
        </div>
      </header>

      {posts.length === 0 ? (
        <p className="py-12 text-center text-neutral-500">Nenhum post publicado ainda. Volte em breve.</p>
      ) : (
        <>
          {/* Destaque */}
          <Link
            href={`/blog/${destaque.slug}`}
            className="group grid overflow-hidden rounded-3xl border border-neutral-200/90 bg-white shadow-sm transition-all duration-300 hover:shadow-lg md:grid-cols-2"
          >
            <div className="overflow-hidden bg-neutral-100">
              {destaque.cover_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={destaque.cover_image_url} alt="" className="h-full min-h-[240px] w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
              ) : (
                <div className="h-full min-h-[240px] w-full bg-gradient-to-br from-teal-100 to-neutral-100" />
              )}
            </div>
            <div className="flex flex-col justify-center p-7 sm:p-10">
              {destaque.keywords[0] && <div><Chip>{destaque.keywords[0]}</Chip></div>}
              <h2 className="mt-3 text-2xl font-bold leading-[1.15] tracking-tight [font-family:var(--font-display)] transition-colors group-hover:text-teal-700 sm:text-[2rem]">
                {destaque.titulo}
              </h2>
              <p className="mt-2"><Meta post={destaque} /></p>
              {destaque.resumo && <p className="mt-4 line-clamp-3 text-[15px] leading-relaxed text-neutral-600">{destaque.resumo}</p>}
              <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-teal-600">
                Ler artigo <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
              </span>
            </div>
          </Link>

          {/* Grade */}
          {resto.length > 0 && (
            <section>
              <h2 className="mb-7 flex items-center gap-3 text-sm font-semibold uppercase tracking-wider text-neutral-400">
                Mais novidades
                <span className="h-px flex-1 bg-neutral-200" />
              </h2>
              <div className="grid gap-x-7 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
                {resto.map((p) => (
                  <Link
                    key={p.slug}
                    href={`/blog/${p.slug}`}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                  >
                    <div className="overflow-hidden bg-neutral-100">
                      {p.cover_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.cover_image_url} alt="" className="aspect-[16/10] w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]" />
                      ) : (
                        <div className="aspect-[16/10] w-full bg-gradient-to-br from-teal-50 to-neutral-100" />
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      {p.keywords[0] && <div className="mb-2"><Chip>{p.keywords[0]}</Chip></div>}
                      <h3 className="text-lg font-semibold leading-snug tracking-tight [font-family:var(--font-display)] transition-colors group-hover:text-teal-700">
                        {p.titulo}
                      </h3>
                      {p.resumo && <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-neutral-600">{p.resumo}</p>}
                      <p className="mt-4 pt-1"><Meta post={p} /></p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
