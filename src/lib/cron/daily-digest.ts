// SERVER ONLY: do not import from client components
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { detectOverdueTasks } from "./detectors/task-overdue";
import { detectTasksDuesoon } from "./detectors/task-prazo-amanha";
import { detectEventsToday } from "./detectors/evento-calendario-hoje";
import { detectMarcosZero24h } from "./detectors/marco-zero-24h";
import { detectClientBirthdays } from "./detectors/aniversario-socio-cliente";
import { detectColaboradorBirthdays } from "./detectors/aniversario-colaborador";
import { detectRenovacoes } from "./detectors/renovacao-contrato";
import { detectSatisfacaoPendente } from "./detectors/satisfacao-pendente";

export interface DigestCounters {
  task_overdue: number;
  task_prazo_amanha: number;
  evento_calendario_hoje: number;
  marco_zero_24h: number;
  aniversario_socio_cliente: number;
  aniversario_colaborador: number;
  renovacao_contrato: number;
  satisfacao_pendente: number;
}

type DigestResult =
  | { counters: DigestCounters; ran_at: string }
  | { skipped: true; reason: string };

export async function runDailyDigest(): Promise<DigestResult> {
  const supabase = createServiceRoleClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: existing } = await supabase
    .from("cron_runs")
    .select("ran_at")
    .eq("job_name", "daily-digest")
    .eq("run_date", today)
    .maybeSingle();
  if (existing) return { skipped: true, reason: "already ran today" };

  await supabase.from("cron_runs").insert({ job_name: "daily-digest", run_date: today });

  const counters: DigestCounters = {
    task_overdue: 0,
    task_prazo_amanha: 0,
    evento_calendario_hoje: 0,
    marco_zero_24h: 0,
    aniversario_socio_cliente: 0,
    aniversario_colaborador: 0,
    renovacao_contrato: 0,
    satisfacao_pendente: 0,
  };

  await safeDetect(() => detectOverdueTasks(counters));
  await safeDetect(() => detectTasksDuesoon(counters));
  await safeDetect(() => detectEventsToday(counters));
  await safeDetect(() => detectMarcosZero24h(counters));
  await safeDetect(() => detectClientBirthdays(counters));
  await safeDetect(() => detectColaboradorBirthdays(counters));
  await safeDetect(() => detectRenovacoes(counters));

  if (new Date().getUTCDay() === 1) {
    await safeDetect(() => detectSatisfacaoPendente(counters));
  }

  await supabase
    .from("cron_runs")
    .update({ details: counters as unknown as import("@/types/database").Json })
    .eq("job_name", "daily-digest")
    .eq("run_date", today);

  return { counters, ran_at: new Date().toISOString() };
}

async function safeDetect(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.error("[daily-digest] detector failed:", err instanceof Error ? err.message : err);
  }
}
