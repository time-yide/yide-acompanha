import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { RuleCard } from "@/components/notificacoes/RuleCard";
import { PreferenceToggle } from "@/components/notificacoes/PreferenceToggle";
import { getMyPreferencesAction } from "@/lib/notificacoes/rule-actions";

const eventLabels: Record<string, string> = {
  task_assigned: "Tarefa atribuída a mim",
  task_completed: "Tarefa concluída",
  kanban_moved: "Card kanban movido",
  prospeccao_agendada: "Prospecção agendada",
  deal_fechado: "Deal fechado",
  mes_aguardando_aprovacao: "Mês aguardando aprovação",
  mes_aprovado: "Mês aprovado",
  cliente_perto_churn: "Cliente perto do churn",
  task_prazo_amanha: "Tarefa vence amanhã",
  task_overdue: "Tarefa atrasada",
  evento_calendario_hoje: "Evento do calendário hoje",
  marco_zero_24h: "Marco zero amanhã",
  aniversario_socio_cliente: "Aniversário sócio cliente",
  aniversario_colaborador: "Aniversário colaborador",
  renovacao_contrato: "Renovação de contrato",
  satisfacao_pendente: "Satisfação pendente",
};

export default async function NotificacoesConfigPage() {
  const user = await requireAuth();
  const isAdmin = canAccess(user.role, "manage:users");

  const supabase = await createClient();
  const { data: rules = [] } = await supabase
    .from("notification_rules")
    .select("evento_tipo, ativo, mandatory, email_default, permite_destinatarios_extras, default_roles, default_user_ids")
    .order("evento_tipo");
  const { data: profiles = [] } = await supabase
    .from("profiles")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome");

  const prefMap = await getMyPreferencesAction();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Notificações</h1>
        <p className="text-sm text-muted-foreground">
          {isAdmin
            ? "Configure as regras do sistema (todos os usuários) e suas preferências pessoais."
            : "Ative ou desative notificações por canal."}
        </p>
      </header>

      {isAdmin && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Regras do sistema</h2>
          <div className="space-y-3">
            {(rules ?? []).map((r) => (
              <RuleCard key={r.evento_tipo} rule={r} profiles={profiles ?? []} />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{isAdmin ? "Suas preferências" : "Preferências"}</h2>
        <p className="text-xs text-muted-foreground">
          Tipos marcados como &quot;obrigatórios&quot; pela administração não podem ser desativados.
        </p>
        <div className="space-y-2">
          {(rules ?? [])
            .filter((r) => !r.mandatory)
            .map((r) => {
              const pref = prefMap.get(r.evento_tipo);
              return (
                <PreferenceToggle
                  key={r.evento_tipo}
                  evento_tipo={r.evento_tipo}
                  label={eventLabels[r.evento_tipo] ?? r.evento_tipo}
                  initialInApp={pref?.in_app ?? true}
                  initialEmail={pref?.email ?? r.email_default}
                />
              );
            })}
        </div>
      </section>
    </div>
  );
}
