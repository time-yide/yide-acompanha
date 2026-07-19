import { notFound } from "next/navigation";
import { after } from "next/server";
import { headers } from "next/headers";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { getOrgPadraoBlog, getPostPublicadoPorSlug } from "@/lib/blog/queries";
import { metaDoPost, jsonLdArtigo, type PostSeoInput } from "@/lib/blog/seo";
import { registrarVisitaPorSlug } from "@/lib/blog/views";
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
  const post = orgId ? await getPostPublicadoPorSlug(orgId, slug) : null;
  return { orgId, post };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { post } = await carregar(slug);
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
  const { orgId, post } = await carregar(slug);
  if (!post) notFound();

  // Registra a visita depois da resposta (não atrasa a página). Lê o UA agora,
  // pois Request APIs não podem ser chamadas dentro do callback do `after`.
  const ua = (await headers()).get("user-agent") ?? "";
  if (orgId) after(() => registrarVisitaPorSlug(orgId, post.slug, ua));

  const url = `${SITE_URL}/blog/${post.slug}`;
  // JSON-LD: escapa `<` pra impedir quebra de </script>.
  const jsonldStr = JSON.stringify(jsonLdArtigo(post as PostSeoInput, url)).replace(/</g, "\\u003c");
  const categoria = post.keywords[0];

  return (
    <article className="mx-auto max-w-2xl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonldStr }} />

      <Link href="/blog" className="inline-flex items-center gap-1 text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-900">
        <ArrowLeft className="h-4 w-4" /> Novidades
      </Link>

      <header className="mt-6">
        {categoria && <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-600">{categoria}</p>}
        <h1 className="mt-2 text-3xl font-bold leading-[1.15] tracking-tight [font-family:var(--font-display)] sm:text-[2.6rem]">
          {post.titulo}
        </h1>
        <p className="mt-3 text-sm text-neutral-500">
          {fmtData(post.published_at)}{post.autor_nome ? ` · ${post.autor_nome}` : ""}
        </p>
      </header>

      {post.cover_image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.cover_image_url} alt="" className="mt-7 aspect-[16/9] w-full rounded-2xl border border-neutral-200 object-cover" />
      )}

      <div className="mt-8">
        <Markdown light>{post.conteudo_md}</Markdown>
      </div>

      <div className="mt-12 rounded-2xl border border-neutral-200 bg-white p-6 text-center">
        <p className="text-lg font-semibold [font-family:var(--font-display)]">Gostou do conteúdo?</p>
        <p className="mt-1 text-sm text-neutral-600">A Yide Digital faz marketing, tráfego e sistemas sob medida pro seu negócio.</p>
        <a
          href="https://yidedigital.com.br"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-block rounded-full bg-teal-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-700"
        >
          Falar com a Yide
        </a>
      </div>
    </article>
  );
}
