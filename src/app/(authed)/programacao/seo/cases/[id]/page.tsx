import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { getOrganizationId } from "@/lib/gerador-leads/queries";
import { podeGerenciarBlog } from "@/lib/blog/acesso";
import { getCaseAdmin } from "@/lib/seo/case-queries";
import { CaseEditor, type CaseEditavel } from "@/components/seo/CaseEditor";

export const dynamic = "force-dynamic";

export default async function CaseEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();
  if (!podeGerenciarBlog(user.role)) notFound();
  const orgId = await getOrganizationId(user.id);
  if (!orgId) notFound();

  const caso = await getCaseAdmin(orgId, id);
  if (!caso) notFound();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = caso as any;
  const publicado = c.status === "publicado";

  const inicial: CaseEditavel = {
    id: c.id,
    cliente: c.cliente ?? "",
    segmento: c.segmento ?? "",
    localidade: c.localidade ?? "",
    desafio: c.desafio ?? "",
    solucao: c.solucao ?? "",
    resultados: Array.isArray(c.resultados) ? c.resultados : [],
    depoimento_texto: c.depoimento_texto ?? "",
    depoimento_autor: c.depoimento_autor ?? "",
    cover_image_url: c.cover_image_url ?? null,
    conteudo_md: c.conteudo_md ?? "",
    meta_title: c.meta_title ?? null,
    meta_description: c.meta_description ?? null,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/programacao/seo/cases" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Cases
        </Link>
        {publicado && (
          <Link href={`/cases/${c.slug}`} target="_blank" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            Ver publicado <ExternalLink className="h-4 w-4" />
          </Link>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        {c.cliente} · <span className={publicado ? "text-emerald-500" : "text-amber-500"}>{publicado ? "Publicado" : "Rascunho"}</span>
      </p>
      <CaseEditor inicial={inicial} />
    </div>
  );
}
