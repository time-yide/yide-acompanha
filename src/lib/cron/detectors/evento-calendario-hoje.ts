// SERVER ONLY: do not import from client components
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
import { formatTimeBR, getDatePartsInAppTz, getAppTimezoneOffsetMs } from "@/lib/datetime/timezone";

export async function detectEventsToday(counters: { evento_calendario_hoje: number }): Promise<void> {
  const supabase = createServiceRoleClient();
  // Bounds do dia local (Cuiabá), convertidos pra ISO UTC pra filtrar `inicio`
  // (timestamptz). Servidor é UTC; sem essa conversão filtramos o "dia UTC",
  // que após ~20h locais corresponde ao dia local seguinte.
  const todayParts = getDatePartsInAppTz();
  const y = parseInt(todayParts.year, 10);
  const m = parseInt(todayParts.month, 10); // 1-12
  const d = parseInt(todayParts.day, 10);
  const pivot = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const offsetMs = getAppTimezoneOffsetMs(pivot);
  const startOfTodayMs = Date.UTC(y, m - 1, d, 0, 0, 0, 0) + offsetMs;
  const startOfTomorrowMs = Date.UTC(y, m - 1, d + 1, 0, 0, 0, 0) + offsetMs;
  const startOfTodayIso = new Date(startOfTodayMs).toISOString();
  const startOfTomorrowIso = new Date(startOfTomorrowMs).toISOString();

  const { data } = await supabase
    .from("calendar_events")
    .select("id, titulo, inicio, participantes_ids")
    .gte("inicio", startOfTodayIso)
    .lt("inicio", startOfTomorrowIso);

  for (const e of (data ?? []) as Array<{ id: string; titulo: string; inicio: string; participantes_ids: string[] }>) {
    if (!e.participantes_ids || e.participantes_ids.length === 0) continue;
    const horario = formatTimeBR(e.inicio);
    await dispatchNotification({
      evento_tipo: "evento_calendario_hoje",
      titulo: "Evento hoje",
      mensagem: `${e.titulo} às ${horario}`,
      link: `/calendario/${e.id}`,
      user_ids_extras: e.participantes_ids,
    });
    counters.evento_calendario_hoje++;
  }
}
