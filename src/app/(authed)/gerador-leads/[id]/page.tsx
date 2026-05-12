import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Star, MapPin, Globe, Award, Sparkles } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { getLeadGerado } from "@/lib/gerador-leads/queries";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LeadActions } from "@/components/gerador-leads/LeadActions";
import { LeadEditCard } from "@/components/gerador-leads/LeadEditCard";
import { STATUS_LEAD_DEFS, POTENCIAL_DEFS } from "@/lib/gerador-leads/tipos";

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
  const potencialDef = lead.potencial_comercial ? POTENCIAL_DEFS[lead.potencial_comercial] : null;

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
          {lead.score !== null && (
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 font-semibold text-primary">
              <Award className="h-3 w-3" /> Score {lead.score}
            </span>
          )}
          {potencialDef && (
            <Badge variant="outline" className={potencialDef.color}>
              Potencial {potencialDef.label}
            </Badge>
          )}
          {lead.qualificado && (
            <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
              ✓ Qualificado
            </Badge>
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

          {/* Form editável */}
          <LeadEditCard lead={lead} canEdit={canEdit} />
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

          {/* IA observações (Fase 3) */}
          {lead.observacoes_ia ? (
            <Card className="p-4 space-y-2 border-primary/30 bg-primary/5">
              <h2 className="font-semibold text-sm flex items-center gap-1">
                <Sparkles className="h-4 w-4 text-primary" /> Análise IA
              </h2>
              <p className="text-xs whitespace-pre-wrap text-foreground/90">
                {lead.observacoes_ia}
              </p>
            </Card>
          ) : (
            <Card className="p-4 space-y-2 border-amber-500/30 bg-amber-500/5">
              <h2 className="font-semibold text-sm flex items-center gap-1">
                <Sparkles className="h-4 w-4 text-amber-600" /> IA na Fase 3
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Quando ativarmos a Fase 3, a IA vai analisar esse lead e gerar:
                score 0-100, qualificado/não, potencial comercial, diagnóstico
                (sem site, marketing fraco, etc.) e abordagem sugerida.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
