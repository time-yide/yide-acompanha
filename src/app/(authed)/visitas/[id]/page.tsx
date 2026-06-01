import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { getOrganizationId, listLeadsGerados } from "@/lib/gerador-leads/queries";
import { getVisita } from "@/lib/visitas/queries";
import { LeadsTable } from "@/components/gerador-leads/LeadsTable";
import { AdicionarLeadVisitaButton } from "@/components/visitas/AdicionarLeadVisitaButton";

const ALLOWED_ROLES = ["adm", "socio", "comercial", "coordenador", "assessor"];

export default async function VisitaDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await requireAuth();
  if (!ALLOWED_ROLES.includes(user.role)) notFound();

  const orgId = await getOrganizationId(user.id);
  if (!orgId) notFound();

  const visita = await getVisita(orgId, id);
  if (!visita) notFound();

  const { leads } = await listLeadsGerados(orgId, { visitaId: id, pageSize: 200 });

  const canManage = ALLOWED_ROLES.includes(user.role);

  const [ano, mes, dia] = visita.data.split("-");
  const dataFormatada = `${dia}/${mes}/${ano}`;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="space-y-1">
        <Link
          href="/visitas"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Voltar para visitas
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{visita.titulo}</h1>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{dataFormatada}</span>
          {(visita.bairro || visita.cidade) && (
            <span>{[visita.bairro, visita.cidade].filter(Boolean).join(", ")}</span>
          )}
          {visita.colaborador_nome && (
            <span>{visita.colaborador_nome}</span>
          )}
        </div>
        {visita.observacoes && (
          <p className="text-sm text-muted-foreground mt-1">{visita.observacoes}</p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">
          Leads desta visita ({leads.length})
        </h2>
        {canManage && <AdicionarLeadVisitaButton visitaId={id} />}
      </div>

      {leads.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum lead adicionado nessa visita ainda.
        </p>
      ) : (
        <LeadsTable leads={leads} canManage={canManage} />
      )}
    </div>
  );
}
