import Link from "next/link";
import type { Metadata } from "next";
import { getOrgPadraoBlog, listPostsPublicados, type BlogPostPublic } from "@/lib/blog/queries";

// Dinâmica (não pré-renderiza no build): usa service-role, cuja env só existe em runtime.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog · Yide Digital",
  description: "Marketing, tecnologia e inteligência artificial — o que importa, direto ao ponto, pela Yide Digital.",
  alternates: { canonical: "/blog" },
  openGraph: { title: "Blog · Yide Digital", description: "Marketing, tecnologia e IA.", type: "website" },
};

function fmtData(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function Categoria({ post }: { post: BlogPostPublic }) {
  const cat = post.keywords[0];
  if (!cat) return null;
  return <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-600">{cat}</span>;
}

export default async function BlogIndex() {
  const orgId = await getOrgPadraoBlog();
  const posts = orgId ? await listPostsPublicados(orgId) : [];
  const [destaque, ...resto] = posts;

  return (
    <div className="space-y-12">
      <header className="border-b border-neutral-200/80 pb-6">
        <h1 className="text-4xl font-bold tracking-tight [font-family:var(--font-display)] sm:text-5xl">Novidades</h1>
        <p className="mt-2 text-neutral-500">Marketing, tecnologia e IA — o que importa, direto ao ponto.</p>
      </header>

      {posts.length === 0 ? (
        <p className="py-12 text-center text-neutral-500">Nenhum post publicado ainda. Volte em breve.</p>
      ) : (
        <>
          {/* Destaque */}
          <Link href={`/blog/${destaque.slug}`} className="group grid gap-6 md:grid-cols-2 md:items-center">
            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100">
              {destaque.cover_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={destaque.cover_image_url} alt="" className="aspect-[16/10] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
              ) : (
                <div className="aspect-[16/10] w-full bg-gradient-to-br from-teal-100 to-neutral-100" />
              )}
            </div>
            <div>
              <Categoria post={destaque} />
              <h2 className="mt-2 text-2xl font-bold leading-tight tracking-tight [font-family:var(--font-display)] group-hover:text-teal-700 sm:text-3xl">
                {destaque.titulo}
              </h2>
              <p className="mt-1 text-xs text-neutral-400">{fmtData(destaque.published_at)}</p>
              {destaque.resumo && <p className="mt-3 text-[15px] leading-relaxed text-neutral-600">{destaque.resumo}</p>}
              <span className="mt-4 inline-block text-sm font-semibold text-teal-600 group-hover:underline">Ler artigo →</span>
            </div>
          </Link>

          {/* Grade */}
          {resto.length > 0 && (
            <div className="grid gap-x-8 gap-y-10 border-t border-neutral-200/80 pt-10 sm:grid-cols-2 lg:grid-cols-3">
              {resto.map((p) => (
                <Link key={p.slug} href={`/blog/${p.slug}`} className="group flex flex-col">
                  <div className="mb-3 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100">
                    {p.cover_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.cover_image_url} alt="" className="aspect-[16/10] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                    ) : (
                      <div className="aspect-[16/10] w-full bg-gradient-to-br from-teal-50 to-neutral-100" />
                    )}
                  </div>
                  <Categoria post={p} />
                  <h3 className="mt-1.5 text-lg font-semibold leading-snug tracking-tight [font-family:var(--font-display)] group-hover:text-teal-700">
                    {p.titulo}
                  </h3>
                  <p className="mt-1 text-xs text-neutral-400">{fmtData(p.published_at)}</p>
                  {p.resumo && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-neutral-600">{p.resumo}</p>}
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
