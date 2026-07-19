import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, FileText } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { getOrganizationId } from "@/lib/gerador-leads/queries";
import { podeGerenciarBlog } from "@/lib/blog/acesso";
import { listPostsAdmin } from "@/lib/blog/queries";
import { NovoPostButton } from "@/components/blog/NovoPostButton";

export const dynamic = "force-dynamic";

function fmtData(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default async function BlogAdminPage() {
  const user = await requireAuth();
  if (!podeGerenciarBlog(user.role)) notFound();
  const orgId = await getOrganizationId(user.id);
  if (!orgId) notFound();

  const posts = await listPostsAdmin(orgId);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/programacao" className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Programação
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Blog</h1>
          <p className="text-sm text-muted-foreground">Conteúdo da Yide pra SEO e autoridade. Rascunhos ficam privados; publicados vão pro blog público.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/blog" target="_blank" className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground">
            Ver blog <ExternalLink className="h-4 w-4" />
          </Link>
          <NovoPostButton />
        </div>
      </div>

      {posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/20 px-6 py-14 text-center">
          <FileText className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm font-medium">Nenhum post ainda</p>
          <p className="text-xs text-muted-foreground">Crie o primeiro post pra começar.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Título</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Autor</th>
                <th className="px-4 py-2 text-right font-medium">Atualizado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {posts.map((p) => {
                const publicado = p.status === "publicado";
                return (
                  <tr key={p.id} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5">
                      <Link href={`/programacao/blog/${p.id}`} className="font-medium hover:underline">{p.titulo}</Link>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${publicado ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"}`}>
                        {publicado ? "Publicado" : "Rascunho"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{p.autor_nome ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{fmtData(p.updated_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
