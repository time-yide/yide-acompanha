import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendWhatsAppMessage } from "@/lib/weekly-reports/evolution-api";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export async function sendBudgetMetaEsgotandoAlerta(): Promise<{
  sent: number;
  skipped: number;
}> {
  const sb = createServiceRoleClient() as SB;

  const { data: campanhas } = await sb
    .from("trafego_campanhas")
    .select("id, nome, client_id, budget_total, budget_diario, status, clients(nome, assessor_id)")
    .eq("status", "ativa")
    .not("budget_total", "is", null);

  if (!campanhas || campanhas.length === 0) return { sent: 0, skipped: 0 };

  interface CampRow {
    id: string;
    nome: string;
    client_id: string;
    budget_total: number;
    budget_diario: number | null;
    status: string;
    clients: { nome: string; assessor_id: string | null } | null;
  }

  interface AlertItem {
    campanhaNome: string;
    clienteNome: string;
    totalGasto: number;
    budgetTotal: number;
    percentual: number;
  }

  const alertsByAssessor = new Map<string, AlertItem[]>();

  for (const camp of campanhas as CampRow[]) {
    if (!camp.budget_total || camp.budget_total <= 0) continue;
    const assessorId = camp.clients?.assessor_id;
    if (!assessorId) continue;

    const { data: metricas } = await sb
      .from("trafego_metricas_diarias")
      .select("valor_numerico")
      .eq("campanha_id", camp.id)
      .eq("metrica_key", "spend");

    if (!metricas || metricas.length === 0) continue;

    interface MetricaRow { valor_numerico: number }
    const totalGasto = (metricas as MetricaRow[]).reduce(
      (sum: number, m: MetricaRow) => sum + (Number(m.valor_numerico) || 0),
      0
    );
    const percentual = (totalGasto / Number(camp.budget_total)) * 100;

    if (percentual >= 80) {
      const list = alertsByAssessor.get(assessorId) ?? [];
      list.push({
        campanhaNome: camp.nome,
        clienteNome: camp.clients?.nome ?? "Cliente",
        totalGasto,
        budgetTotal: Number(camp.budget_total),
        percentual: Math.round(percentual),
      });
      alertsByAssessor.set(assessorId, list);
    }
  }

  if (alertsByAssessor.size === 0) return { sent: 0, skipped: 0 };

  const assessorIds = [...alertsByAssessor.keys()];
  const { data: profiles } = await sb
    .from("profiles")
    .select("id, nome, telefone")
    .in("id", assessorIds);

  interface Profile { id: string; nome: string; telefone: string | null }
  const profileMap = new Map<string, Profile>();
  for (const p of (profiles ?? []) as Profile[]) {
    profileMap.set(p.id, p);
  }

  let sent = 0;
  let skipped = 0;

  for (const [assessorId, alerts] of alertsByAssessor) {
    const profile = profileMap.get(assessorId);
    if (!profile?.telefone) { skipped++; continue; }

    const lines = [
      `💰 *Budget Meta esgotando!*`,
      ``,
      `${profile.nome?.split(" ")[0] ?? ""}, campanhas com orçamento acima de 80%:`,
      ``,
    ];

    for (const a of alerts) {
      const icon = a.percentual >= 95 ? "🔴" : "🟡";
      lines.push(`${icon} *${a.clienteNome}* — "${a.campanhaNome}"`);
      lines.push(`   Gasto: R$ ${a.totalGasto.toFixed(2)} / R$ ${a.budgetTotal.toFixed(2)} (*${a.percentual}%*)`);
    }

    lines.push(``);
    lines.push(`Avalie se precisa pausar ou ajustar! 📊`);

    const result = await sendWhatsAppMessage(profile.telefone, lines.join("\n"));
    if (result.success) sent++;
    else skipped++;
  }

  return { sent, skipped };
}
