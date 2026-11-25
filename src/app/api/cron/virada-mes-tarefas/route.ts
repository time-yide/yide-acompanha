import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getTodayDate } from "@/lib/datetime/timezone";
import { primeiroDiaUtilDoMes, ultimoDiaUtilDoMes } from "@/lib/datas/dias-uteis";
import { avisarUltimoDiaUtil, passarTarefasProMes } from "@/lib/tarefas/virada-mes";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Roda todo dia de manhã. Só faz algo em dois dias do mês:
// - último dia útil → avisa quem tem tarefa em aberto;
// - dia 1º → passa o que ficou em aberto pro 1º dia útil do mês novo.
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = getTodayDate();
  const supabase = createServiceRoleClient();
  const out: Record<string, unknown> = { today };

  async function jaRodou(jobName: string): Promise<boolean> {
    const { data } = await supabase
      .from("cron_runs")
      .select("ran_at")
      .eq("job_name", jobName)
      .eq("run_date", today)
      .maybeSingle();
    if (data) return true;
    await supabase.from("cron_runs").insert({ job_name: jobName, run_date: today });
    return false;
  }

  if (today === ultimoDiaUtilDoMes(today) && !(await jaRodou("virada-mes-tarefas-aviso"))) {
    out.aviso = await avisarUltimoDiaUtil();
  }

  if (today.endsWith("-01") && !(await jaRodou("virada-mes-tarefas-passar"))) {
    out.passar = await passarTarefasProMes(primeiroDiaUtilDoMes(today));
  }

  return NextResponse.json(out);
}
