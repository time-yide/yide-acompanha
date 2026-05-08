// SERVER ONLY
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";

interface CounterShape { evento_calendario_amanha: number }
interface EventRow {
  id: string;
  titulo: string;
  inicio: string;
  participantes_ids: string[];
  sub_calendar: string;
}

/**
 * Pra cada usuário com 1+ eventos amanhã, dispara UMA notificação resumo
 * com até 5 eventos formatados como "10h — Reunião X · 14h — Gravação Y".
 * Mais que 5 vira "...e mais N".
 *
 * Timezone: usa BRT pra calcular "amanhã" (UTC-3, sem DST). Isso casa com
 * o cron rodando às 21:00 UTC (18:00 BRT).
 */
export async function detectEventsTomorrow(counters: CounterShape): Promise<void> {
  const supabase = createServiceRoleClient();

  // "Amanhã" em BRT — shift -3h da hora UTC pra trabalhar no fuso BRT
  const nowBRT = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const tomorrowBRT = new Date(nowBRT.getFullYear(), nowBRT.getMonth(), nowBRT.getDate() + 1);
  // Reconverte os limites pra UTC pra usar no .gte/.lt
  const startUTC = new Date(tomorrowBRT.getTime() + 3 * 60 * 60 * 1000);
  const endUTC = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000);

  const { data } = await supabase
    .from("calendar_events")
    .select("id, titulo, inicio, participantes_ids, sub_calendar")
    .gte("inicio", startUTC.toISOString())
    .lt("inicio", endUTC.toISOString())
    .order("inicio", { ascending: true });

  const events = (data ?? []) as EventRow[];
  if (events.length === 0) return;

  // Agrupa por usuário (cada participante recebe um digest seu)
  const byUser = new Map<string, EventRow[]>();
  for (const e of events) {
    if (!e.participantes_ids || e.participantes_ids.length === 0) continue;
    for (const userId of e.participantes_ids) {
      const list = byUser.get(userId) ?? [];
      list.push(e);
      byUser.set(userId, list);
    }
  }

  for (const [userId, userEvents] of byUser) {
    const titulo =
      userEvents.length === 1
        ? "Você tem 1 evento amanhã"
        : `Você tem ${userEvents.length} eventos amanhã`;

    const preview = userEvents.slice(0, 5).map((e) => {
      const hora = new Date(e.inicio).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo",
      });
      const prefix = e.sub_calendar === "videomakers" ? "Gravação" : "Reunião";
      return `${hora} — ${prefix} ${e.titulo}`;
    }).join(" · ");

    const remaining = userEvents.length - 5;
    const mensagem = remaining > 0 ? `${preview} · ...e mais ${remaining}` : preview;

    await dispatchNotification({
      evento_tipo: "evento_calendario_amanha",
      titulo,
      mensagem,
      link: "/calendario",
      user_ids_extras: [userId],
    });
    counters.evento_calendario_amanha++;
  }
}
