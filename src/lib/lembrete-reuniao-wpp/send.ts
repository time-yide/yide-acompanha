import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendWhatsAppGroupMessage } from "@/lib/weekly-reports/evolution-api";
import {
  formatTimeBR,
  getTodayDate,
  getDayBoundariesIso,
} from "@/lib/datetime/timezone";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

interface EventRow {
  id: string;
  titulo: string;
  inicio: string;
  client_id: string;
}

interface ClientRow {
  nome: string;
  grupo_wpp_jid: string | null;
  contato_principal: string | null;
}

export async function sendLembreteReuniaoWpp(): Promise<{
  sent: number;
  skipped: number;
}> {
  const sb = createServiceRoleClient() as SB;
  const today = getTodayDate();
  const { fromIso, toIso } = getDayBoundariesIso(today);

  const { data: events } = await sb
    .from("calendar_events")
    .select("id, titulo, inicio, client_id")
    .eq("sub_calendar", "agencia")
    .gte("inicio", fromIso)
    .lt("inicio", toIso)
    .is("deleted_at", null)
    .not("client_id", "is", null);

  const rows = (events ?? []) as EventRow[];
  let sent = 0;
  let skipped = 0;

  for (const ev of rows) {
    const dedupKey = `lembrete-reuniao-wpp-${ev.id}`;
    const { data: already } = await sb
      .from("cron_runs")
      .select("ran_at")
      .eq("job_name", dedupKey)
      .maybeSingle();

    if (already) {
      skipped++;
      continue;
    }

    const { data: client } = await sb
      .from("clients")
      .select("nome, grupo_wpp_jid, contato_principal")
      .eq("id", ev.client_id)
      .maybeSingle();

    const c = client as ClientRow | null;
    if (!c?.grupo_wpp_jid) {
      skipped++;
      continue;
    }

    const nome = c.contato_principal || c.nome;
    const horaBr = formatTimeBR(ev.inicio);

    const msg = [
      `Oi${nome ? ` ${nome}` : ""}! Lembrando que temos reunião hoje às *${horaBr}*`,
      ``,
      `*${ev.titulo}*`,
      ``,
      `Vou mandar o link aqui no grupo na hora. Qualquer coisa avisa!`,
    ].join("\n");

    const result = await sendWhatsAppGroupMessage(c.grupo_wpp_jid, msg);

    if (result.success) {
      await sb.from("cron_runs").insert({ job_name: dedupKey, run_date: today });
      sent++;
    } else {
      skipped++;
    }
  }

  return { sent, skipped };
}
