import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getLeadById, listLeadHistory, listLeadAttempts } from "@/lib/leads/queries";
import { updateLeadAction } from "@/lib/leads/actions";
import { LeadForm } from "@/components/onboarding/LeadForm";
import { StageTransitionButtons } from "@/components/onboarding/StageTransitionButtons";
import { AddAttemptForm } from "@/components/onboarding/AddAttemptForm";
import { LeadAttemptsTimeline } from "@/components/onboarding/LeadAttemptsTimeline";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Stage } from "@/lib/leads/schema";

const STAGE_LABEL: Record<string, string> = {
  prospeccao: "Prospecção", comercial: "Reunião Comercial",
  contrato: "Contrato", marco_zero: "Marco Zero", ativo: "Cliente ativo",
};

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAuth();

  let lead;
  try { lead = await getLeadById(id); } catch { notFound(); }

  const supabase = await createClient();
  const [{ data: profiles = [] }, history, attempts] = await Promise.all([
    supabase.from("profiles").select("id, nome, role").eq("ativo", true).order("nome"),
    listLeadHistory(id),
    listLeadAttempts(id),
  ]);

  const coordenadores = (profiles ?? []).filter((p) => p.role === "coordenador");
  const assessores = (profiles ?? []).filter((p) => p.role === "assessor");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{lead.nome_prospect}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="secondary">{STAGE_LABEL[lead.stage]}</Badge>
            {lead.client_id && (
              // @ts-expect-error nested
              <Link href={`/clientes/${lead.client_id}`} className="text-xs text-primary hover:underline">
                → Cliente: {lead.cliente?.nome}
              </Link>
            )}
          </div>
        </div>
      </header>

      <Card className="p-5">
        <h2 className="mb-3 text-lg font-semibold">Mover de estágio</h2>
        <StageTransitionButtons leadId={lead.id} currentStage={lead.stage as Stage} />
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 text-lg font-semibold">Dados do prospect</h2>
        <LeadForm
          action={updateLeadAction}
          defaults={{
            id: lead.id,
            nome_prospect: lead.nome_prospect,
            site: lead.site,
            contato_principal: lead.contato_principal,
            email: lead.email,
            telefone: lead.telefone,
            valor_proposto: lead.valor_proposto,
            duracao_meses: lead.duracao_meses,
            servico_proposto: lead.servico_proposto,
            info_briefing: lead.info_briefing,
            prioridade: lead.prioridade,
            data_prospeccao_agendada: lead.data_prospeccao_agendada,
            data_reuniao_marco_zero: lead.data_reuniao_marco_zero,
            coord_alocado_id: lead.coord_alocado_id,
            assessor_alocado_id: lead.assessor_alocado_id,
          }}
          coordenadores={coordenadores}
          assessores={assessores}
          isEdit
          submitLabel="Salvar alterações"
        />
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Tentativas de contato</h2>
        <AddAttemptForm leadId={lead.id} />
        <LeadAttemptsTimeline attempts={attempts} />
      </div>

      <Card className="p-5">
        <h2 className="mb-3 text-lg font-semibold">Histórico de estágios</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem histórico.</p>
        ) : (
          <ol className="space-y-2 text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex items-center gap-2">
                <Badge variant="secondary">
                  {h.from_stage ? `${STAGE_LABEL[h.from_stage]} → ` : ""}{STAGE_LABEL[h.to_stage]}
                </Badge>
                {/* @ts-expect-error nested */}
                <span className="text-xs text-muted-foreground">por {h.ator?.nome ?? "—"} · {new Date(h.created_at).toLocaleString("pt-BR")}</span>
                {h.observacao && <span className="text-xs italic">— {h.observacao}</span>}
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
