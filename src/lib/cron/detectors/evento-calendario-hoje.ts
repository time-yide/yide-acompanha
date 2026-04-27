// SERVER ONLY: do not import from client components
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";

export async function detectEventsToday(counters: { evento_calendario_hoje: number }): Promise<void> {
  const supabase = createServiceRoleClient();
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);

  const { data } = await supabase
    .from("calendar_events")
    .select("id, titulo, inicio, participantes_ids")
    .gte("inicio", startOfToday.toISOString())
    .lt("inicio", startOfTomorrow.toISOString());

  for (const e of (data ?? []) as Array<{ id: string; titulo: string; inicio: string; participantes_ids: string[] }>) {
    if (!e.participantes_ids || e.participantes_ids.length === 0) continue;
    const horario = new Date(e.inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
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
