import { NextResponse } from "next/server";
import { getOrgsComAutoCampanha, criarCampanhaHoje, getCampanhaHoje, temLigacaoAtivaCampanha } from "@/lib/auto-campanha/queries";
import { discarProximoLead, dentroDoHorario } from "@/lib/auto-campanha/discar-proximo";
import { sendWebPushToUser } from "@/lib/push/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const configs = await getOrgsComAutoCampanha();
  if (configs.length === 0) {
    return NextResponse.json({ ok: true, skipped: "nenhuma org com auto campanha" });
  }

  const resultados: Array<{ orgId: string; resultado: string }> = [];

  for (const config of configs) {
    if (!dentroDoHorario(config)) {
      resultados.push({ orgId: config.organization_id, resultado: "fora_horario" });
      continue;
    }

    const existente = await getCampanhaHoje(config.organization_id);
    if (existente && existente.status !== "em_andamento") {
      resultados.push({ orgId: config.organization_id, resultado: "campanha_ja_concluida" });
      continue;
    }

    if (await temLigacaoAtivaCampanha(config.organization_id)) {
      resultados.push({ orgId: config.organization_id, resultado: "ligacao_ativa" });
      continue;
    }

    const novaCampanha = !existente;
    const campanha = existente ?? await criarCampanhaHoje(
      config.organization_id,
      config.power_dialer_colaborador_id,
    );

    if (novaCampanha && config.power_dialer_colaborador_id) {
      try {
        await sendWebPushToUser(config.power_dialer_colaborador_id, {
          title: "Campanha iniciou!",
          body: `Meta: ${config.auto_campanha_meta_atendidas} atendidas. Horario: ${config.auto_campanha_horario_inicio}-${config.auto_campanha_horario_fim}.`,
          url: "/ligacoes",
          tag: "auto-campanha",
          urgent: true,
        });
      } catch { /* push is best-effort */ }
    }

    const r = await discarProximoLead(config.organization_id, config, campanha.id);
    resultados.push({ orgId: config.organization_id, resultado: r.discou ? "discando" : (r.motivo ?? "erro") });
  }

  return NextResponse.json({ ok: true, resultados });
}
