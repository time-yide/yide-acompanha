import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { generateWeeklyReport } from "@/lib/weekly-reports/generator";
import { sendWhatsAppMessage, formatWeeklyReportMessage } from "@/lib/weekly-reports/evolution-api";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = createServiceRoleClient();
  const sbAny = sb as any;

  // last week Monday to Sunday
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0=Sun
  const lastMonday = new Date(now);
  lastMonday.setUTCDate(now.getUTCDate() - dayOfWeek - 6);
  const lastSunday = new Date(lastMonday);
  lastSunday.setUTCDate(lastMonday.getUTCDate() + 6);

  const semanaInicio = lastMonday.toISOString().slice(0, 10);
  const semanaFim = lastSunday.toISOString().slice(0, 10);

  const { data: clients } = await sbAny
    .from("clients")
    .select("id, nome, telefone, organization_id")
    .eq("status", "ativo");

  let generated = 0;
  let whatsappSent = 0;

  for (const client of clients ?? []) {
    try {
      const { data: existing } = await sbAny
        .from("weekly_reports")
        .select("id")
        .eq("client_id", client.id)
        .eq("semana_inicio", semanaInicio)
        .maybeSingle();

      if (existing) continue;

      const reportData = await generateWeeklyReport(
        client.id,
        client.organization_id,
        semanaInicio,
        semanaFim
      );

      await sbAny.from("weekly_reports").insert({
        organization_id: client.organization_id,
        client_id: client.id,
        semana_inicio: semanaInicio,
        semana_fim: semanaFim,
        dados: reportData,
      });

      generated++;

      if (client.telefone) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
        const portalLink = `${appUrl}/cliente`;

        const msg = formatWeeklyReportMessage(
          client.nome,
          semanaInicio,
          semanaFim,
          reportData,
          portalLink
        );

        const result = await sendWhatsAppMessage(client.telefone, msg);
        if (result.success) {
          await sbAny
            .from("weekly_reports")
            .update({
              whatsapp_enviado: true,
              whatsapp_enviado_em: new Date().toISOString(),
            })
            .eq("client_id", client.id)
            .eq("semana_inicio", semanaInicio);
          whatsappSent++;
        }
      }
    } catch (err) {
      console.error(`Weekly report error for ${client.nome}:`, err);
    }
  }

  return NextResponse.json({ semanaInicio, semanaFim, generated, whatsappSent });
}
