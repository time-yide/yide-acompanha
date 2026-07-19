import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { getOrganizationId } from "@/lib/gerador-leads/queries";
import { podeGerenciarBlog } from "@/lib/blog/acesso";
import { getPaginaAdmin, listServicos, listLocalidades } from "@/lib/seo/queries";
import { caminhoPagina } from "@/lib/seo/slug";
import { SeoEditor, type SeoPaginaEditavel } from "@/components/seo/SeoEditor";

export const dynamic = "force-dynamic";

export default async function SeoEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();
  if (!podeGerenciarBlog(user.role)) notFound();
  const orgId = await getOrganizationId(user.id);
  if (!orgId) notFound();

  const pagina = await getPaginaAdmin(orgId, id);
  if (!pagina) notFound();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = pagina as any;

  const [servicos, localidades] = await Promise.all([listServicos(orgId), listLocalidades(orgId)]);
  const servico = servicos.find((s) => s.id === p.service_id);
  const localidade = localidades.find((l) => l.id === p.localidade_id);
  const publicado = p.status === "publicado";

  const editavel: SeoPaginaEditavel = {
    id: p.id, titulo: p.titulo, meta_title: p.meta_title, meta_description: p.meta_description, conteudo_md: p.conteudo_md,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/programacao/seo" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Serviços & SEO Local
        </Link>
        {publicado && servico && localidade && (
          <Link href={caminhoPagina(servico.slug, localidade.slug)} target="_blank" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            Ver publicado <ExternalLink className="h-4 w-4" />
          </Link>
        )}
      </div>
      {servico && localidade && (
        <p className="text-sm text-muted-foreground">
          {servico.nome} · {localidade.nome} ({localidade.uf}) · <span className={publicado ? "text-emerald-500" : "text-amber-500"}>{publicado ? "Publicado" : "Rascunho"}</span>
        </p>
      )}
      <SeoEditor pagina={editavel} />
    </div>
  );
}
