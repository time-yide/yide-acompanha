import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Star, MapPin, Globe } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { getLeadGerado } from "@/lib/gerador-leads/queries";
import { Card } from "@/components/ui/card";
import { LeadActions } from "@/components/gerador-leads/LeadActions";
import { LeadEditCard } from "@/components/gerador-leads/LeadEditCard";
import { IdentificacaoOficialCard } from "@/components/gerador-leads/IdentificacaoOficialCard";
import { STATUS_LEAD_DEFS } from "@/lib/gerador-leads/tipos";

const ALLOWED_ROLES = ["adm", "socio", "comercial", "coordenador", "assessor"];
const ROLES_QUE_GERENCIAM = ["adm", "socio", "comercial", "coordenador", "assessor"];

export default async function LeadDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireAuth();
  if (!ALLOWED_ROLES.includes(user.role)) notFound();

  const lead = await getLeadGerado(id);
  if (!lead) notFound();

  const canEdit = ROLES_QUE_GERENCIAM.includes(user.role);
  const statusDef = STATUS_LEAD_DEFS[lead.status as keyof typeof STATUS_LEAD_DEFS];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="space-y-1">
        <Link
          href="/gerador-leads"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Voltar pra lista
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{lead.empresa}</h1>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {statusDef && (
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-medium ${statusDef.color}`}>
              {statusDef.label}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4 min-w-0">
          {/* Ações rápidas */}
          <Card className="p-4 space-y-3">
            <h2 className="font-semibold text-sm">Ações rápidas</h2>
            <LeadActions lead={lead} canManage={canEdit} />
          </Card>

          {/* Identificação oficial (CNPJ + sócios + contato da Receita) */}
          <IdentificacaoOficialCard
            cnpj={lead.cnpj}
            socios={lead.socios ?? []}
            telefone={lead.telefone_receita}
            email={lead.email_receita}
          />

          {/* Form editável */}
          {/* key força remount quando lead atualiza - useState do form reinicializa com novos valores */}
          <LeadEditCard key={lead.updated_at} lead={lead} canEdit={canEdit} />
        </div>

        {/* Sidebar com info do Google Maps */}
        <div className="space-y-4">
          <Card className="p-4 space-y-3">
            <h2 className="font-semibold text-sm">📍 Google Maps</h2>
            {lead.google_rating !== null && (
              <div className="flex items-center gap-2 text-sm">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <strong>{lead.google_rating.toFixed(1)}</strong>
                {lead.google_reviews_count !== null && (
                  <span className="text-muted-foreground">
                    ({lead.google_reviews_count} avaliações)
                  </span>
                )}
              </div>
            )}
            {lead.categoria && (
              <p className="text-xs">
                <strong className="text-muted-foreground">Categoria:</strong>{" "}
                {lead.categoria}
              </p>
            )}
            {lead.endereco && (
              <p className="text-xs flex items-start gap-1">
                <MapPin className="h-3 w-3 shrink-0 mt-0.5 text-muted-foreground" />
                {lead.endereco}
              </p>
            )}
            {lead.cidade && (
              <p className="text-xs">
                <strong className="text-muted-foreground">Cidade:</strong>{" "}
                {lead.cidade}{lead.estado ? `/${lead.estado}` : ""}
              </p>
            )}
            {lead.dominio && (
              <p className="text-xs">
                <strong className="text-muted-foreground">Domínio:</strong>{" "}
                <code className="rounded bg-muted px-1 py-0.5">{lead.dominio}</code>
              </p>
            )}
            {lead.google_maps_url && (
              <a
                href={lead.google_maps_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Globe className="h-3 w-3" /> Abrir no Maps
              </a>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
