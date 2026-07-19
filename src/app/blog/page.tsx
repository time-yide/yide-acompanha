import Link from "next/link";
import type { Metadata } from "next";
import { getOrgPadraoBlog, listPostsPublicados } from "@/lib/blog/queries";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Blog · Yide Digital",
  description: "Conteúdo sobre marketing, tecnologia e inteligência artificial pela Yide Digital.",
  alternates: { canonical: "/blog" },
  openGraph: { title: "Blog · Yide Digital", description: "Marketing, tecnologia e IA.", type: "website" },
};

function fmtData(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

export default async function BlogIndex() {
  const orgId = await getOrgPadraoBlog();
  const posts = orgId ? await listPostsPublicados(orgId) : [];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight">Blog</h1>
        <p className="mt-1 text-muted-foreground">Marketing, tecnologia e IA — o que importa, direto ao ponto.</p>
      </header>

      {posts.length === 0 ? (
        <p className="text-muted-foreground">Nenhum post publicado ainda. Volte em breve.</p>
      ) : (
        <div className="space-y-8">
          {posts.map((p) => (
            <article key={p.slug} className="group">
              <Link href={`/blog/${p.slug}`} className="block">
                {p.cover_image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.cover_image_url} alt="" className="mb-3 aspect-[16/9] w-full rounded-xl border object-cover" />
                )}
                <h2 className="text-xl font-bold tracking-tight group-hover:text-primary">{p.titulo}</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">{fmtData(p.published_at)}{p.autor_nome ? ` · ${p.autor_nome}` : ""}</p>
                {p.resumo && <p className="mt-2 text-[15px] text-foreground/80">{p.resumo}</p>}
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
