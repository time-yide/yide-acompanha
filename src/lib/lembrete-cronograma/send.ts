import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendWhatsAppMessage } from "@/lib/weekly-reports/evolution-api";
import { getDatePartsInAppTz } from "@/lib/datetime/timezone";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

const PACOTES_COM_CRONOGRAMA = [
  "estrategia",
  "trafego_estrategia",
  "yide_360",
  "trafego",
];

export async function sendLembreteCronograma(): Promise<{
  sent: number;
  skipped: number;
}> {
  const sb = createServiceRoleClient() as SB;

  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const { year, month } = getDatePartsInAppTz(nextMonth);
  const mesRef = `${year}-${String(month).padStart(2, "0")}`;
  const mesLabel = nextMonth.toLocaleString("pt-BR", { month: "long", year: "numeric" });

  const { data: clients } = await sb
    .from("clients")
    .select("id, nome, assessor_id, tipo_pacote")
    .eq("status", "ativo")
    .not("assessor_id", "is", null)
    .in("tipo_pacote", PACOTES_COM_CRONOGRAMA);

  if (!clients || clients.length === 0) return { sent: 0, skipped: 0 };

  const clientIds = clients.map((c: { id: string }) => c.id);

  const { data: existingCalendars } = await sb
    .from("content_calendars")
    .select("client_id")
    .in("client_id", clientIds)
    .eq("mes_referencia", mesRef);

  const hasCalendar = new Set(
    ((existingCalendars ?? []) as Array<{ client_id: string }>).map((c) => c.client_id),
  );

  const missing = clients.filter((c: { id: string }) => !hasCalendar.has(c.id));

  if (missing.length === 0) return { sent: 0, skipped: 0 };

  const byAssessor = new Map<string, string[]>();
  for (const c of missing) {
    const list = byAssessor.get(c.assessor_id) ?? [];
    list.push(c.nome);
    byAssessor.set(c.assessor_id, list);
  }

  const assessorIds = [...byAssessor.keys()];
  const { data: profiles } = await sb
    .from("profiles")
    .select("id, nome, telefone")
    .in("id", assessorIds);

  interface Profile { id: string; nome: string; telefone: string | null }
  const profileMap = new Map<string, Profile>();
  for (const p of (profiles ?? []) as Profile[]) {
    profileMap.set(p.id, p);
  }

  let sent = 0;
  let skipped = 0;

  for (const [assessorId, clientNames] of byAssessor) {
    const profile = profileMap.get(assessorId);
    if (!profile?.telefone) {
      skipped++;
      continue;
    }

    const lines = [
      `📅 *Cronograma pendente — ${mesLabel}*`,
      ``,
      `${profile.nome?.split(" ")[0] ?? ""}, *${clientNames.length}* cliente(s) ainda sem cronograma pro próximo mês:`,
      ``,
      ...clientNames.map((n: string) => `• ${n}`),
      ``,
      `Acesse o sistema pra gerar! ⚡`,
    ];

    const result = await sendWhatsAppMessage(profile.telefone, lines.join("\n"));
    if (result.success) sent++;
    else skipped++;
  }

  return { sent, skipped };
}
