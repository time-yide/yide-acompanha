import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { getOrgPadraoBlog, getPostPublicadoPorSlug } from "@/lib/blog/queries";
import { metaDoPost, jsonLdArtigo, type PostSeoInput } from "@/lib/blog/seo";
import { Markdown } from "@/components/blog/Markdown";
import { SITE_URL } from "@/lib/blog/config";

// Dinâmica (não pré-renderiza no build): usa service-role, cuja env só existe em runtime.
export const dynamic = "force-dynamic";

function fmtData(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

async function carregar(slug: string) {
  const orgId = await getOrgPadraoBlog();
  return orgId ? getPostPublicadoPorSlug(orgId, slug) : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await carregar(slug);
  if (!post) return { title: "Post não encontrado · Yide Blog" };
  const { title, description } = metaDoPost(post as PostSeoInput);
  return {
    title: `${title} · Yide Blog`,
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title, description, type: "article",
      publishedTime: post.published_at ?? undefined,
      modifiedTime: post.updated_at,
      images: post.cover_image_url ? [post.cover_image_url] : undefined,
    },
    twitter: { card: "summary_large_image", title, description, images: post.cover_image_url ? [post.cover_image_url] : undefined },
    keywords: post.keywords.length ? post.keywords : undefined,
  };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await carregar(slug);
  if (!post) notFound();

  const url = `${SITE_URL}/blog/${post.slug}`;
  // JSON-LD: escapa `<` pra impedir quebra de </script> (conteúdo é de autor interno,
  // mas escapamos por segurança). É dado estruturado, não HTML renderizado.
  const jsonldStr = JSON.stringify(jsonLdArtigo(post as PostSeoInput, url)).replace(/</g, "\\u003c");

  return (
    <article className="space-y-5">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonldStr }} />

      <Link href="/blog" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Blog
      </Link>

      <header className="space-y-2">
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight">{post.titulo}</h1>
        <p className="text-xs text-muted-foreground">
          {fmtData(post.published_at)}{post.autor_nome ? ` · ${post.autor_nome}` : ""}
        </p>
      </header>

      {post.cover_image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.cover_image_url} alt="" className="aspect-[16/9] w-full rounded-xl border object-cover" />
      )}

      <Markdown>{post.conteudo_md}</Markdown>

      {post.fonte_url && (
        <p className="border-t pt-4 text-xs text-muted-foreground">
          Fonte:{" "}
          <a href={post.fonte_url} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-2">
            {post.fonte_nome || post.fonte_url}
          </a>
        </p>
      )}
    </article>
  );
}
