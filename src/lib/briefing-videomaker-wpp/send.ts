import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendWhatsAppMessage } from "@/lib/weekly-reports/evolution-api";
import { formatDateBR, formatTimeBR } from "@/lib/datetime/timezone";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://sistemaacompanha.yidedigital.com.br";

export async function sendBriefingVideomakerWpp(): Promise<{
  sent: number;
  skipped: number;
}> {
  const sb = createServiceRoleClient() as SB;

  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);
  const oneDayAgoIso = oneDayAgo.toISOString();

  const { data: events } = await sb
    .from("calendar_events")
    .select(`
      id, titulo, inicio, fim, client_id,
      localizacao_endereco, localizacao_maps_url,
      observacoes_gravacao, link_roteiro,
      videomaker_assigned_id, videomaker_delegado_em,
      clients(nome)
    `)
    .eq("sub_calendar", "videomakers")
    .eq("videomaker_status", "scheduled")
    .gte("videomaker_delegado_em", oneDayAgoIso)
    .not("videomaker_assigned_id", "is", null)
    .is("deleted_at", null);

  if (!events || events.length === 0) return { sent: 0, skipped: 0 };

  interface EventRow {
    id: string;
    titulo: string;
    inicio: string;
    fim: string;
    client_id: string | null;
    localizacao_endereco: string | null;
    localizacao_maps_url: string | null;
    observacoes_gravacao: string | null;
    link_roteiro: string | null;
    videomaker_assigned_id: string;
    videomaker_delegado_em: string;
    clients: { nome: string } | null;
  }

  const rows = events as EventRow[];

  const vmIds = [...new Set(rows.map((e) => e.videomaker_assigned_id))];
  const { data: profiles } = await sb
    .from("profiles")
    .select("id, nome, telefone")
    .in("id", vmIds);

  interface Profile { id: string; nome: string; telefone: string | null }
  const profileMap = new Map<string, Profile>();
  for (const p of (profiles ?? []) as Profile[]) {
    profileMap.set(p.id, p);
  }

  let sent = 0;
  let skipped = 0;

  for (const ev of rows) {
    const dedupKey = `briefing-wpp-${ev.id}`;
    const { data: existing } = await sb
      .from("cron_runs")
      .select("ran_at")
      .eq("job_name", dedupKey)
      .maybeSingle();
    if (existing) { skipped++; continue; }

    const vm = profileMap.get(ev.videomaker_assigned_id);
    if (!vm?.telefone) { skipped++; continue; }

    await sb.from("cron_runs").insert({
      job_name: dedupKey,
      run_date: new Date().toISOString().split("T")[0],
    });

    const clienteNome = ev.clients?.nome ?? "Cliente";
    const lines = [
      `🎬 *Nova gravação delegada!*`,
      ``,
      `Oi ${vm.nome?.split(" ")[0] ?? ""}! Você foi designado pra uma gravação:`,
      ``,
      `📌 *Cliente:* ${clienteNome}`,
      `📅 *Data:* ${formatDateBR(ev.inicio.split("T")[0])}`,
      `⏰ *Horário:* ${formatTimeBR(ev.inicio)} às ${formatTimeBR(ev.fim)}`,
    ];

    if (ev.localizacao_endereco) {
      lines.push(`📍 *Local:* ${ev.localizacao_endereco}`);
    }
    if (ev.localizacao_maps_url) {
      lines.push(`🗺️ *Maps:* ${ev.localizacao_maps_url}`);
    }
    if (ev.observacoes_gravacao) {
      lines.push(`📝 *Observações:* ${ev.observacoes_gravacao}`);
    }
    if (ev.link_roteiro) {
      lines.push(`📋 *Roteiro:* ${ev.link_roteiro}`);
    }

    lines.push(``);
    lines.push(`🔗 *Briefing completo:* ${APP_URL}/calendario/${ev.id}/briefing`);
    lines.push(``);
    lines.push(`Bora! 💪`);

    const result = await sendWhatsAppMessage(vm.telefone, lines.join("\n"));
    if (result.success) sent++;
    else skipped++;
  }

  return { sent, skipped };
}
