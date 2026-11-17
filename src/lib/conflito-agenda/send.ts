import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendWhatsAppMessage } from "@/lib/weekly-reports/evolution-api";
import { formatDateBR, formatTimeBR, getTodayDate } from "@/lib/datetime/timezone";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export async function sendConflitoAgendaAlerta(): Promise<{
  sent: number;
  skipped: number;
}> {
  const sb = createServiceRoleClient() as SB;
  const today = getTodayDate();

  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 7);
  const futureIso = futureDate.toISOString();
  const todayIso = new Date(today).toISOString();

  const { data: events } = await sb
    .from("calendar_events")
    .select("id, titulo, inicio, fim, client_id, videomaker_assigned_id, clients(nome, assessor_id)")
    .eq("sub_calendar", "videomakers")
    .gte("inicio", todayIso)
    .lt("inicio", futureIso)
    .is("deleted_at", null)
    .not("videomaker_assigned_id", "is", null)
    .order("inicio");

  if (!events || events.length === 0) return { sent: 0, skipped: 0 };

  interface Event {
    id: string;
    titulo: string;
    inicio: string;
    fim: string;
    client_id: string;
    videomaker_assigned_id: string;
    clients: { nome: string; assessor_id: string | null } | null;
  }
  const rows = events as Event[];

  const byVideomaker = new Map<string, Event[]>();
  for (const ev of rows) {
    const list = byVideomaker.get(ev.videomaker_assigned_id) ?? [];
    list.push(ev);
    byVideomaker.set(ev.videomaker_assigned_id, list);
  }

  interface Conflict {
    ev1: Event;
    ev2: Event;
  }
  const conflictsByAssessor = new Map<string, Conflict[]>();

  for (const [, vmEvents] of byVideomaker) {
    if (vmEvents.length < 2) continue;

    for (let i = 0; i < vmEvents.length; i++) {
      for (let j = i + 1; j < vmEvents.length; j++) {
        const a = vmEvents[i];
        const b = vmEvents[j];
        if (a.inicio < b.fim && a.fim > b.inicio) {
          const assessorId = a.clients?.assessor_id ?? b.clients?.assessor_id;
          if (!assessorId) continue;
          const list = conflictsByAssessor.get(assessorId) ?? [];
          list.push({ ev1: a, ev2: b });
          conflictsByAssessor.set(assessorId, list);
        }
      }
    }
  }

  if (conflictsByAssessor.size === 0) return { sent: 0, skipped: 0 };

  const assessorIds = [...conflictsByAssessor.keys()];
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

  for (const [assessorId, conflicts] of conflictsByAssessor) {
    const profile = profileMap.get(assessorId);
    if (!profile?.telefone) { skipped++; continue; }

    const lines = [
      `⚠️ *Conflito de agenda detectado!*`,
      ``,
      `${profile.nome?.split(" ")[0] ?? ""}, foram encontrados conflitos de horário:`,
      ``,
    ];

    for (const c of conflicts.slice(0, 5)) {
      lines.push(`🔴 *${formatDateBR(c.ev1.inicio.split("T")[0])}*`);
      lines.push(`  • ${formatTimeBR(c.ev1.inicio)}–${formatTimeBR(c.ev1.fim)} — ${c.ev1.clients?.nome ?? "Cliente"}`);
      lines.push(`  • ${formatTimeBR(c.ev2.inicio)}–${formatTimeBR(c.ev2.fim)} — ${c.ev2.clients?.nome ?? "Cliente"}`);
      lines.push(``);
    }

    lines.push(`Ajuste na agenda pra evitar problemas! 📋`);

    const result = await sendWhatsAppMessage(profile.telefone, lines.join("\n"));
    if (result.success) sent++;
    else skipped++;
  }

  return { sent, skipped };
}
