// SERVER ONLY: do not import from client components

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendPushToClient } from "@/lib/cliente-portal/push";
import { currentIsoWeek } from "@/lib/satisfacao/iso-week";

/**
 * Toda segunda-feira: dispara Web Push pros clientes que ainda não
 * registraram autoavaliação na semana ISO atual. Cliente sem portal
 * user ativo não recebe nada (sendPushToClient já é no-op nesse caso).
 *
 * Counter incrementa pra cada cliente notificado.
 */
export async function detectClienteSelfSatisfactionSemanal(
  counters: { cliente_self_satisfaction_semanal: number },
): Promise<void> {
  const dayOfWeek = new Date().getUTCDay(); // 1 = segunda
  if (dayOfWeek !== 1) return;

  const admin = createServiceRoleClient();

  const { data: clientsData } = await admin
    .from("clients")
    .select("id")
    .eq("status", "ativo")
    .is("deleted_at", null);
  const clients = (clientsData ?? []) as Array<{ id: string }>;
  if (clients.length === 0) return;

  const weekStart = startOfIsoWeek(new Date()).toISOString();
  const { data: satisfData } = await admin
    .from("client_self_satisfaction")
    .select("client_id")
    .gte("submitted_at", weekStart);
  const submetidos = new Set(
    ((satisfData ?? []) as Array<{ client_id: string }>).map((s) => s.client_id),
  );

  const payload = {
    title: "Yide · Como tá a parceria essa semana?",
    body: "Manda sua nota rapidinho pra gente saber como melhorar 👋",
    url: "/cliente",
    tag: "self-satisfaction-semanal",
  };
  for (const c of clients) {
    if (submetidos.has(c.id)) continue;
    await sendPushToClient(c.id, payload);
    counters.cliente_self_satisfaction_semanal++;
  }

  // `currentIsoWeek` import só pra documentar a semântica de "semana atual"
  // — não usamos diretamente, mas garante consistência com /satisfacao.
  void currentIsoWeek;
}

/** Segunda-feira 00:00 UTC da semana ISO da data passada. */
function startOfIsoWeek(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  if (day !== 1) d.setUTCDate(d.getUTCDate() - (day - 1));
  return d;
}
