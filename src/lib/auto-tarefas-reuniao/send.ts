import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendWhatsAppMessage } from "@/lib/weekly-reports/evolution-api";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export async function sendAutoTarefasReuniao(): Promise<{
  created: number;
  notified: number;
  skipped: number;
}> {
  const sb = createServiceRoleClient() as SB;

  const { data: sugeridas } = await sb
    .from("meeting_extracted_tasks")
    .select("id, meeting_id, titulo_sugerido, descricao_sugerida, estado, meetings(id, owner_user_id, client_id, titulo, clients(nome, assessor_id))")
    .eq("estado", "sugerida");

  if (!sugeridas || sugeridas.length === 0) return { created: 0, notified: 0, skipped: 0 };

  interface TaskSugerida {
    id: string;
    meeting_id: string;
    titulo_sugerido: string;
    descricao_sugerida: string | null;
    estado: string;
    meetings: {
      id: string;
      owner_user_id: string;
      client_id: string | null;
      titulo: string | null;
      clients: { nome: string; assessor_id: string | null } | null;
    } | null;
  }

  let created = 0;
  let skipped = 0;

  const criadosByAssessor = new Map<string, { clienteNome: string; tituloTarefa: string; reuniaoTitulo: string }[]>();

  for (const sug of sugeridas as TaskSugerida[]) {
    if (!sug.meetings) { skipped++; continue; }

    const { data: taskCreated, error } = await sb
      .from("tasks")
      .insert({
        titulo: sug.titulo_sugerido,
        descricao: sug.descricao_sugerida ?? null,
        prioridade: "media",
        tipo: "geral",
        formatos: [],
        status_aprovacao: null,
        atribuido_a: sug.meetings.owner_user_id,
        client_id: sug.meetings.client_id ?? null,
        criado_por: sug.meetings.owner_user_id,
        participantes_ids: [],
        links: [],
        attachment_urls: [],
      })
      .select("id")
      .single();

    if (error || !taskCreated) { skipped++; continue; }

    await sb
      .from("meeting_extracted_tasks")
      .update({ estado: "aceita", task_id: taskCreated.id })
      .eq("id", sug.id);

    created++;

    const assessorId = sug.meetings.clients?.assessor_id ?? sug.meetings.owner_user_id;
    const list = criadosByAssessor.get(assessorId) ?? [];
    list.push({
      clienteNome: sug.meetings.clients?.nome ?? "Interno",
      tituloTarefa: sug.titulo_sugerido,
      reuniaoTitulo: sug.meetings.titulo ?? "Reunião",
    });
    criadosByAssessor.set(assessorId, list);
  }

  if (criadosByAssessor.size === 0) return { created, notified: 0, skipped };

  const assessorIds = [...criadosByAssessor.keys()];
  const { data: profiles } = await sb
    .from("profiles")
    .select("id, nome, telefone")
    .in("id", assessorIds);

  interface Profile { id: string; nome: string; telefone: string | null }
  let notified = 0;

  for (const prof of (profiles ?? []) as Profile[]) {
    if (!prof.telefone) continue;
    const items = criadosByAssessor.get(prof.id);
    if (!items || items.length === 0) continue;

    const lines = [
      `📝 *Tarefas criadas da reunião*`,
      ``,
      `${prof.nome?.split(" ")[0] ?? ""}, criei *${items.length}* tarefa(s) automaticamente:`,
      ``,
    ];

    for (const item of items.slice(0, 8)) {
      lines.push(`• *${item.clienteNome}* — ${item.tituloTarefa}`);
      lines.push(`  📎 Da reunião: "${item.reuniaoTitulo}"`);
    }

    if (items.length > 8) {
      lines.push(`  … e mais ${items.length - 8}`);
    }

    lines.push(``);
    lines.push(`Confira e ajuste prazos no sistema! ✅`);

    const result = await sendWhatsAppMessage(prof.telefone, lines.join("\n"));
    if (result.success) notified++;
  }

  return { created, notified, skipped };
}
