import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendWhatsAppMessage } from "@/lib/weekly-reports/evolution-api";
import { formatDateBR, formatTimeBR, getTodayDate } from "@/lib/datetime/timezone";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export async function sendVideomakerIndisponivelAlerta(): Promise<{
  sent: number;
  skipped: number;
}> {
  const sb = createServiceRoleClient() as SB;
  const today = getTodayDate();

  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 7);
  const futureIso = futureDate.toISOString().split("T")[0];

  const { data: bloqueios } = await sb
    .from("agenda_bloqueios")
    .select("id, criado_por, criado_por_nome, data, hora_inicio, hora_fim, motivo")
    .eq("status", "aprovada")
    .gte("data", today)
    .lte("data", futureIso)
    .is("deleted_at", null);

  if (!bloqueios || bloqueios.length === 0) return { sent: 0, skipped: 0 };

  interface Bloqueio {
    id: string;
    criado_por: string;
    criado_por_nome: string;
    data: string;
    hora_inicio: string;
    hora_fim: string;
    motivo: string;
  }

  const rows = bloqueios as Bloqueio[];

  const blockedDates = [...new Set(rows.map((b) => b.data))];

  const { data: recordings } = await sb
    .from("calendar_events")
    .select("id, titulo, inicio, fim, client_id, videomaker_assigned_id, clients(nome, assessor_id)")
    .eq("sub_calendar", "videomakers")
    .in("inicio::date", blockedDates)
    .is("deleted_at", null);

  if (!recordings || recordings.length === 0) return { sent: 0, skipped: 0 };

  interface Recording {
    id: string;
    titulo: string;
    inicio: string;
    fim: string;
    client_id: string;
    videomaker_assigned_id: string | null;
    clients: { nome: string; assessor_id: string | null } | null;
  }

  const recRows = recordings as Recording[];

  interface Conflict {
    videomakerNome: string;
    clienteNome: string;
    data: string;
    horaGravacao: string;
    motivo: string;
  }
  const conflictsByAssessor = new Map<string, Conflict[]>();

  for (const rec of recRows) {
    const assessorId = rec.clients?.assessor_id;
    if (!assessorId) continue;

    const recDate = rec.inicio.split("T")[0];
    const recStart = rec.inicio;
    const recEnd = rec.fim;

    for (const bl of rows) {
      if (bl.data !== recDate) continue;
      if (rec.videomaker_assigned_id && rec.videomaker_assigned_id !== bl.criado_por) continue;

      const blStart = `${bl.data}T${bl.hora_inicio}`;
      const blEnd = `${bl.data}T${bl.hora_fim}`;
      if (blStart < recEnd && blEnd > recStart) {
        const list = conflictsByAssessor.get(assessorId) ?? [];
        list.push({
          videomakerNome: bl.criado_por_nome,
          clienteNome: rec.clients?.nome ?? "Cliente",
          data: bl.data,
          horaGravacao: formatTimeBR(rec.inicio),
          motivo: bl.motivo,
        });
        conflictsByAssessor.set(assessorId, list);
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
    if (!profile?.telefone) {
      skipped++;
      continue;
    }

    const lines = [
      `⚠️ *Videomaker indisponível!*`,
      ``,
      `${profile.nome?.split(" ")[0] ?? ""}, atenção a conflitos nos próximos dias:`,
      ``,
    ];

    for (const c of conflicts) {
      lines.push(`• *${c.clienteNome}* — gravação ${formatDateBR(c.data)} às ${c.horaGravacao}`);
      lines.push(`  📌 *${c.videomakerNome}* bloqueado: "${c.motivo}"`);
    }

    lines.push(``);
    lines.push(`Verifique a agenda e realoque se necessário! 📋`);

    const result = await sendWhatsAppMessage(profile.telefone, lines.join("\n"));
    if (result.success) sent++;
    else skipped++;
  }

  return { sent, skipped };
}
