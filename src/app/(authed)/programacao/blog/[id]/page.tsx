import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { getOrganizationId } from "@/lib/gerador-leads/queries";
import { podeGerenciarBlog } from "@/lib/blog/acesso";
import { getPostAdmin } from "@/lib/blog/queries";
import { BlogEditor } from "@/components/blog/BlogEditor";

export const dynamic = "force-dynamic";

export default async function BlogEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();
  if (!podeGerenciarBlog(user.role)) notFound();
  const orgId = await getOrganizationId(user.id);
  if (!orgId) notFound();

  const post = await getPostAdmin(orgId, id);
  if (!post) notFound();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/programacao/blog" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Blog
        </Link>
        {post.status === "publicado" && (
          <Link href={`/blog/${post.slug}`} target="_blank" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            Ver publicado <ExternalLink className="h-4 w-4" />
          </Link>
        )}
      </div>
      <BlogEditor post={post} />
    </div>
  );
}
