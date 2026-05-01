// SERVER ONLY
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export async function runRecadosArquivar(): Promise<{ arquivados: number; ran_at: string } | { skipped: true; reason: string }> {
  const supabase = createServiceRoleClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: existing } = await supabase
    .from("cron_runs")
    .select("ran_at")
    .eq("job_name", "recados-arquivar")
    .eq("run_date", today)
    .maybeSingle();
  if (existing) return { skipped: true, reason: "already ran today" };

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  const { data: arquivados, error } = await supabase
    .from("recados")
    .update({ arquivado: true })
    .eq("arquivado", false)
    .eq("permanente", false)
    .lt("criado_em", cutoff.toISOString())
    .select("id");

  if (error) throw new Error(`Falha ao arquivar recados: ${error.message}`);

  await supabase.from("cron_runs").insert({
    job_name: "recados-arquivar",
    run_date: today,
    details: { arquivados: arquivados?.length ?? 0 },
  });

  return { arquivados: arquivados?.length ?? 0, ran_at: new Date().toISOString() };
}
