import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendWhatsAppMessage } from "@/lib/weekly-reports/evolution-api";

const INACTIVITY_DAYS = 14;

interface InactiveClient {
  clientId: string;
  clientNome: string;
  assessorId: string;
  assessorNome: string;
  assessorTelefone: string | null;
  lastActivityDate: string | null;
  daysSinceActivity: number | null;
}

export async function sendAlertasInatividade(): Promise<{
  sent: number;
  inactive: number;
}> {
  const supabase = createServiceRoleClient();

  // 1. Get all active clients with their assessor info
  const { data: clients, error: clientsError } = await supabase
    .from("clients")
    .select("id, nome, assessor_id")
    .eq("status", "ativo")
    .not("assessor_id", "is", null);

  if (clientsError || !clients) {
    console.error("Error fetching clients:", clientsError);
    return { sent: 0, inactive: 0 };
  }

  // Filter out ecommerce clients (not real clients)
  const realClients = clients.filter(
    (c) => !c.nome.toLowerCase().startsWith("ecommerce"),
  );

  const now = new Date();
  const cutoffDate = new Date(
    now.getTime() - INACTIVITY_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const inactiveClients: InactiveClient[] = [];

  // 2. For each client, check most recent activity across 3 tables
  for (const client of realClients) {
    const [postsRes, tasksRes, eventsRes] = await Promise.all([
      supabase
        .from("social_media_posts")
        .select("created_at")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("tasks")
        .select("created_at")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("calendar_events")
        .select("inicio")
        .eq("client_id", client.id)
        .order("inicio", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const dates = [
      postsRes.data?.created_at,
      tasksRes.data?.created_at,
      eventsRes.data?.inicio,
    ].filter(Boolean) as string[];

    const lastActivity =
      dates.length > 0
        ? dates.reduce((a, b) => (a > b ? a : b))
        : null;

    const isInactive =
      lastActivity === null || lastActivity < cutoffDate;

    if (isInactive) {
      inactiveClients.push({
        clientId: client.id,
        clientNome: client.nome,
        assessorId: client.assessor_id!,
        assessorNome: "",
        assessorTelefone: null,
        lastActivityDate: lastActivity,
        daysSinceActivity: lastActivity
          ? Math.floor(
              (now.getTime() - new Date(lastActivity).getTime()) /
                (1000 * 60 * 60 * 24),
            )
          : null,
      });
    }
  }

  if (inactiveClients.length === 0) {
    return { sent: 0, inactive: 0 };
  }

  // 3. Group inactive clients by assessor
  const byAssessor = new Map<string, InactiveClient[]>();
  for (const ic of inactiveClients) {
    const list = byAssessor.get(ic.assessorId) ?? [];
    list.push(ic);
    byAssessor.set(ic.assessorId, list);
  }

  // 4. Fetch assessor profiles (phone + name)
  const assessorIds = [...byAssessor.keys()];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, nome, telefone")
    .in("id", assessorIds);

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, p]),
  );

  // 5. Send one WhatsApp message per assessor
  let sent = 0;

  for (const [assessorId, clientList] of byAssessor) {
    const profile = profileMap.get(assessorId);
    if (!profile?.telefone) {
      console.warn(
        `Assessor ${assessorId} sem telefone, pulando alerta de inatividade`,
      );
      continue;
    }

    const message = formatMessage(clientList);
    const result = await sendWhatsAppMessage(profile.telefone, message);

    if (result.success) {
      sent++;
    } else {
      console.error(
        `Falha ao enviar alerta de inatividade para ${profile.nome}:`,
        result.error,
      );
    }
  }

  return { sent, inactive: inactiveClients.length };
}

function formatMessage(clients: InactiveClient[]): string {
  const lines = clients.map((c) => {
    if (c.daysSinceActivity != null) {
      return `• *${c.clientNome}* — último registro há ${c.daysSinceActivity} dias`;
    }
    return `• *${c.clientNome}* — sem atividade recente`;
  });

  return [
    "⚠️ *Alerta: Clientes sem atividade*",
    "",
    `Os seguintes clientes estão há mais de ${INACTIVITY_DAYS} dias sem atividade:`,
    "",
    ...lines,
    "",
    "Verifique se está tudo ok! 👀",
  ].join("\n");
}
