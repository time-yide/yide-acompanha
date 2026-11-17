import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendWhatsAppGroupMessage } from "@/lib/weekly-reports/evolution-api";
import { formatDateBR, getTodayDate } from "@/lib/datetime/timezone";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export async function sendGravacaoCanceladaAlerta(): Promise<{
  sent: number;
  skipped: number;
}> {
  const sb = createServiceRoleClient() as SB;

  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);
  const oneDayAgoIso = oneDayAgo.toISOString();

  const { data: events } = await sb
    .from("calendar_events")
    .select("id, titulo, inicio, fim, client_id, videomaker_assigned_id, clients(nome, grupo_wpp_jid, contato_principal)")
    .eq("sub_calendar", "videomakers")
    .eq("videomaker_status", "cancelled")
    .gte("updated_at", oneDayAgoIso)
    .not("client_id", "is", null);

  if (!events || events.length === 0) return { sent: 0, skipped: 0 };

  interface CancelledEvent {
    id: string;
    titulo: string;
    inicio: string;
    fim: string;
    client_id: string;
    videomaker_assigned_id: string | null;
    clients: { nome: string; grupo_wpp_jid: string | null; contato_principal: string | null } | null;
  }

  let sent = 0;
  let skipped = 0;

  for (const ev of events as CancelledEvent[]) {
    if (!ev.clients?.grupo_wpp_jid) { skipped++; continue; }

    const dedupKey = `gravacao-cancelada-${ev.id}`;
    const { data: existing } = await sb
      .from("cron_runs")
      .select("ran_at")
      .eq("job_name", dedupKey)
      .maybeSingle();
    if (existing) { skipped++; continue; }

    await sb.from("cron_runs").insert({
      job_name: dedupKey,
      run_date: getTodayDate(),
    });

    const availableDates = await findTwoAvailableDates(sb, ev.videomaker_assigned_id);

    const nome = ev.clients.contato_principal || ev.clients.nome;
    const lines = [
      `📢 *Gravação reagendada*`,
      ``,
      `Olá${nome ? `, *${nome}*` : ""}! A gravação prevista para ${formatDateBR(ev.inicio.split("T")[0])} precisou ser reagendada.`,
      ``,
    ];

    if (availableDates.length > 0) {
      lines.push(`Temos as seguintes datas disponíveis:`);
      for (const d of availableDates) {
        const dayName = getDayName(d);
        lines.push(`📅 *${dayName}, ${formatDateBR(d)}*`);
      }
      lines.push(``);
      lines.push(`Qual fica melhor pra vocês? 😊`);
    } else {
      lines.push(`Estamos verificando novas datas e retornamos em breve! 😊`);
    }

    const result = await sendWhatsAppGroupMessage(ev.clients.grupo_wpp_jid, lines.join("\n"));
    if (result.success) sent++;
    else skipped++;
  }

  return { sent, skipped };
}

async function findTwoAvailableDates(
  sb: SB,
  videomakerId: string | null,
): Promise<string[]> {
  const available: string[] = [];
  const today = new Date();

  for (let i = 1; i <= 21 && available.length < 2; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const day = d.getDay();
    if (day === 0 || day === 6) continue;

    const dateStr = d.toISOString().split("T")[0];

    if (videomakerId) {
      const { data: eventsOnDay } = await sb
        .from("calendar_events")
        .select("id")
        .eq("sub_calendar", "videomakers")
        .eq("videomaker_assigned_id", videomakerId)
        .gte("inicio", `${dateStr}T00:00:00`)
        .lt("inicio", `${dateStr}T23:59:59`)
        .is("deleted_at", null)
        .neq("videomaker_status", "cancelled")
        .limit(1);

      if (eventsOnDay && eventsOnDay.length > 0) continue;

      const { data: bloqueios } = await sb
        .from("agenda_bloqueios")
        .select("id")
        .eq("criado_por", videomakerId)
        .eq("status", "aprovada")
        .eq("data", dateStr)
        .is("deleted_at", null)
        .limit(1);

      if (bloqueios && bloqueios.length > 0) continue;
    }

    available.push(dateStr);
  }

  return available;
}

function getDayName(dateStr: string): string {
  const days = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
  const d = new Date(dateStr + "T12:00:00");
  return days[d.getDay()];
}
