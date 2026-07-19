// Puro/testável — metadados de SEO e JSON-LD de artigo pros posts do blog.

export interface PostSeoInput {
  titulo: string;
  resumo: string | null;
  conteudo_md: string;
  meta_title: string | null;
  meta_description: string | null;
  cover_image_url: string | null;
  published_at: string | null;
  updated_at: string;
  autor_nome?: string | null;
  fonte_url?: string | null;
  fonte_nome?: string | null;
}

/** Remove marcações de markdown pra virar texto plano (usado no fallback de description). */
export function stripMarkdown(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")     // imagens
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")   // links → texto
    .replace(/[#>*_`~-]/g, " ")                 // símbolos de markdown
    .replace(/\s+/g, " ")
    .trim();
}

export const BLOG_PUBLISHER = "Yide Digital";

/** Title/description finais do post, com fallbacks. Description limitada a ~155 chars. */
export function metaDoPost(p: PostSeoInput): { title: string; description: string } {
  const title = (p.meta_title || p.titulo).trim();
  const base = p.meta_description || p.resumo || stripMarkdown(p.conteudo_md);
  const description = base.trim().slice(0, 155);
  return { title, description };
}

/** JSON-LD schema.org/Article — Google (rich results) e buscas de IA entendem o post. */
export function jsonLdArtigo(p: PostSeoInput, url: string): Record<string, unknown> {
  const { title, description } = metaDoPost(p);
  const jsonld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    dateModified: p.updated_at,
    mainEntityOfPage: url,
    publisher: { "@type": "Organization", name: BLOG_PUBLISHER },
  };
  if (p.cover_image_url) jsonld.image = [p.cover_image_url];
  if (p.published_at) jsonld.datePublished = p.published_at;
  if (p.autor_nome) jsonld.author = { "@type": "Person", name: p.autor_nome };
  return jsonld;
}
