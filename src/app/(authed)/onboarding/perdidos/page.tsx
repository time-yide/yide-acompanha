import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, XCircle, Wallet, Calendar } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { listLeadsPerdidos } from "@/lib/leads/queries";
import { canInteractWithStage, type Stage } from "@/lib/leads/schema";
import { RestoreLeadButton } from "@/components/onboarding/RestoreLeadButton";
import { OnboardingRealtimeWatcher } from "@/components/onboarding/OnboardingRealtimeWatcher";
import { APP_TIMEZONE } from "@/lib/datetime/timezone";

const ROLES_PERMITIDOS = ["adm", "socio", "comercial", "assessor", "coordenador", "audiovisual_chefe"];

const STAGE_LABEL: Record<string, string> = {
  leads_potencial: "Leads em potencial",
  leads_ativos: "Leads ativos",
  reuniao_comercial: "Reunião comercial",
  proposta_enviada: "Proposta enviada",
  contrato: "Contrato",
  marco_zero: "Marco zero",
  ativo: "Ativação do lead",
  prospeccao: "Leads ativos",
  comercial: "Reunião comercial",
};

function formatBR(date: string | null | undefined) {
  if (!date) return "—";
  return new Date(date).toLocaleString("pt-BR", { timeZone: APP_TIMEZONE, dateStyle: "short", timeStyle: "short" });
}

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function PerdidosPage() {
  const user = await requireAuth();
  if (!ROLES_PERMITIDOS.includes(user.role)) redirect("/");
  const leads = await listLeadsPerdidos();

  return (
    <div className="space-y-5">
      {/* Atualiza ao vivo quando alguém marca/restaura um perdido. */}
      <OnboardingRealtimeWatcher />

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            Voltar pro pipeline
          </Link>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 mt-1">
            <XCircle className="h-6 w-6 text-rose-500" />
            Leads perdidos
          </h1>
          <p className="text-sm text-muted-foreground">
            {leads.length} lead{leads.length !== 1 ? "s" : ""} marcado{leads.length !== 1 ? "s" : ""} como perdido{leads.length !== 1 ? "s" : ""}.
            Restaurar volta o card pro mesmo estágio onde estava.
          </p>
        </div>
      </header>

      {leads.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center text-sm text-muted-foreground">
          Nenhum lead perdido ainda. Quando alguém marcar perdido no kanban, vai aparecer aqui.
        </div>
      ) : (
        <div className="space-y-2">
          {leads.map((lead) => {
            const canRestore = canInteractWithStage(user.role, lead.stage as Stage);
            return (
              <div
                key={lead.id}
                className="rounded-xl border bg-card p-4 flex flex-wrap items-start justify-between gap-3"
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/onboarding/${lead.id}`}
                      className="font-semibold hover:underline"
                    >
                      {lead.nome_prospect}
                    </Link>
                    <span className="inline-flex items-center rounded-full border border-muted-foreground/30 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                      Estava em: {STAGE_LABEL[lead.stage] ?? lead.stage}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {lead.valor_proposto > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Wallet className="h-3 w-3" />
                        {formatBRL(lead.valor_proposto)}
                        {lead.duracao_meses ? `/${lead.duracao_meses}m` : "/mês"}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Perdido em {formatBR(lead.marcado_perdido_em)}
                    </span>
                    {lead.comercial_nome && (
                      <span>Comercial: {lead.comercial_nome}</span>
                    )}
                  </div>

                  <div className="rounded-md border-l-2 border-rose-500/40 bg-rose-500/5 px-3 py-2 text-xs">
                    <span className="font-medium text-rose-600 dark:text-rose-400">Motivo: </span>
                    <span className="text-foreground">{lead.motivo_perdido}</span>
                  </div>
                </div>

                {canRestore && <RestoreLeadButton leadId={lead.id} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
