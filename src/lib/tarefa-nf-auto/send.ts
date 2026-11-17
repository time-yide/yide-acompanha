import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getTodayDate } from "@/lib/datetime/timezone";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export async function criarTarefasNfAuto(): Promise<{
  created: number;
  skipped: number;
}> {
  const sb = createServiceRoleClient() as SB;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayIso = yesterday.toISOString();

  const { data: clients } = await sb
    .from("clients")
    .select("id, nome")
    .eq("status", "ativo")
    .gte("updated_at", yesterdayIso);

  if (!clients || clients.length === 0) return { created: 0, skipped: 0 };

  const { data: financeiro } = await sb
    .from("profiles")
    .select("id")
    .eq("role", "financeiro")
    .eq("ativo", true)
    .limit(1)
    .maybeSingle();

  if (!financeiro) return { created: 0, skipped: 0 };

  const { data: adm } = await sb
    .from("profiles")
    .select("id")
    .in("role", ["adm", "socio"])
    .eq("ativo", true)
    .limit(1)
    .maybeSingle();

  const criadorId = adm?.id ?? financeiro.id;

  let created = 0;
  let skipped = 0;

  for (const client of clients as Array<{ id: string; nome: string }>) {
    const { data: existing } = await sb
      .from("cron_runs")
      .select("ran_at")
      .eq("job_name", `tarefa-nf-auto-${client.id}`)
      .maybeSingle();

    if (existing) {
      skipped++;
      continue;
    }

    await sb.from("cron_runs").insert({
      job_name: `tarefa-nf-auto-${client.id}`,
      run_date: getTodayDate(),
    });

    await sb.from("tasks").insert({
      titulo: `Emitir NF — ${client.nome}`,
      descricao: `Emitir nota fiscal de serviço (NFS-e) para o cliente ${client.nome} que acabou de ser ativado.`,
      criado_por: criadorId,
      atribuido_a: financeiro.id,
      client_id: client.id,
      tipo: "geral",
      prioridade: "alta",
    });

    created++;
  }

  return { created, skipped };
}
