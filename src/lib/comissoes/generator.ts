// SERVER ONLY: do not import from client components
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { calculateCommission } from "@/lib/comissoes/calculator";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";

type GenerateResult = { skipped: true; reason: string } | { count: number };

function formatMonth(monthRef: string): string {
  const [year, month] = monthRef.split("-");
  const names = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return `${names[Number(month) - 1]} ${year}`;
}

export async function generateMonthlySnapshots(monthRef: string): Promise<GenerateResult> {
  const supabase = createServiceRoleClient();

  // Idempotência
  const { data: existing } = await supabase
    .from("commission_snapshots")
    .select("id")
    .eq("mes_referencia", monthRef)
    .limit(1);
  if (existing && existing.length > 0) {
    return { skipped: true, reason: "already generated" };
  }

  // Lista colaboradores elegíveis
  const { data: profilesRows } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("ativo", true)
    .neq("role", "socio");
  const profiles = (profilesRows ?? []) as Array<{ id: string; role: string }>;

  let count = 0;
  for (const p of profiles) {
    const calc = await calculateCommission(p.id, monthRef);
    if (!calc) continue;

    const valor_total =
      Number(calc.snapshot.fixo) + Number(calc.snapshot.valor_variavel);

    const { data: snap } = await supabase
      .from("commission_snapshots")
      .insert({
        mes_referencia: monthRef,
        user_id: p.id,
        papel_naquele_mes: p.role,
        fixo: calc.snapshot.fixo,
        percentual_aplicado: calc.snapshot.percentual_aplicado,
        base_calculo: calc.snapshot.base_calculo,
        valor_variavel: calc.snapshot.valor_variavel,
        valor_total,
      })
      .select("id")
      .single();
    if (!snap) continue;

    if (calc.items.length > 0) {
      await supabase
        .from("commission_snapshot_items")
        .insert(
          calc.items.map((i) => ({
            snapshot_id: snap.id,
            tipo: i.tipo,
            descricao: i.descricao,
            base: i.base,
            percentual: i.percentual,
            valor: i.valor,
            client_id: i.client_id ?? null,
            lead_id: i.lead_id ?? null,
          })),
        );
    }
    count++;
  }

  await dispatchNotification({
    evento_tipo: "mes_aguardando_aprovacao",
    titulo: `Comissão de ${formatMonth(monthRef)} aguardando aprovação`,
    mensagem: `${count} snapshots gerados`,
    link: "/comissoes/fechamento",
  });

  return { count };
}
