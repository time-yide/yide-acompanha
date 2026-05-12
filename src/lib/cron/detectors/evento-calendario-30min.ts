// SERVER ONLY
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
import { APP_TIMEZONE } from "@/lib/datetime/timezone";

interface CounterShape { evento_calendario_30min: number }
interface EventRow {
  id: string;
  titulo: string;
  inicio: string;
  participantes_ids: string[];
  sub_calendar: string;
}

/**
 * Janela de 10 min em volta do "30 antes" pra absorver atrasos do cron.
 * O index parcial idx_calendar_events_inicio_pending_reminder (criado na
 * migration de PR A) otimiza essa query.
 */
export async function detectEventsIn30Min(counters: CounterShape): Promise<void> {
  const supabase = createServiceRoleClient();
  const now = new Date();
  const lo = new Date(now.getTime() + 25 * 60 * 1000).toISOString();
  const hi = new Date(now.getTime() + 35 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from("calendar_events")
    .select("id, titulo, inicio, participantes_ids, sub_calendar")
    .gte("inicio", lo)
    .lt("inicio", hi)
    .is("reminded_30min_at", null);

  const events = (data ?? []) as EventRow[];
  for (const e of events) {
    if (!e.participantes_ids || e.participantes_ids.length === 0) {
      // Marca como lembrado mesmo sem participantes pra não voltar nas próximas runs
      await supabase
        .from("calendar_events")
        .update({ reminded_30min_at: new Date().toISOString() })
        .eq("id", e.id)
        .is("reminded_30min_at", null);
      continue;
    }

    const prefix = e.sub_calendar === "videomakers" ? "Gravação" : "Reunião";
    await dispatchNotification({
      evento_tipo: "evento_calendario_30min",
      titulo: `Em 30 min: ${prefix} ${e.titulo}`,
      mensagem: `Começa às ${new Date(e.inicio).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: APP_TIMEZONE,
      })}`,
      link: `/calendario/${e.id}`,
      user_ids_extras: e.participantes_ids,
    });

    // Marca como lembrado APÓS o dispatch. Race condition entre runs paralelos
    // protegida pelo WHERE reminded_30min_at IS NULL.
    await supabase
      .from("calendar_events")
      .update({ reminded_30min_at: new Date().toISOString() })
      .eq("id", e.id)
      .is("reminded_30min_at", null);

    counters.evento_calendario_30min++;
  }
}
