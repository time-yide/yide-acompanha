import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
import { logAudit } from "@/lib/audit/log";
import { checarFreelaVideomaker } from "@/lib/calendario/freela-check";
import { getCoordenadoresAudiovisualIds } from "@/lib/tarefas/client-team";

// ─── Auto-delegação de videomaker a gravação ────────────────────────────────

interface VideomakerCandidate {
  id: string;
  nome: string;
  scheduledCount: number;
}

/**
 * Tenta auto-delegar um videomaker a um evento pending_delegation.
 * Escolhe o videomaker ativo com MENOS gravações agendadas nos próximos
 * 30 dias e sem conflito de horário/freela.
 *
 * Best-effort: se falhar, o evento fica pending_delegation pro manual.
 */
export async function autoAssignVideomaker(
  eventId: string,
  actorId: string,
): Promise<void> {
  try {
    await _autoAssignVideomakerImpl(eventId, actorId);
  } catch (e) {
    console.error("[auto-delegate] autoAssignVideomaker failed:", e);
  }
}

async function _autoAssignVideomakerImpl(
  eventId: string,
  actorId: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;

  const { data: event } = await sb
    .from("calendar_events")
    .select("id, titulo, inicio, fim, sub_calendar, videomaker_status, participantes_ids")
    .eq("id", eventId)
    .single();
  if (!event) return;
  if (event.sub_calendar !== "videomakers") return;
  if (event.videomaker_status !== "pending_delegation") return;

  const { data: videomakers } = await sb
    .from("profiles")
    .select("id, nome")
    .in("role", ["videomaker", "fast_midia"])
    .eq("ativo", true);
  if (!videomakers || videomakers.length === 0) return;

  const now = new Date();
  const windowEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const vmIds = (videomakers as { id: string; nome: string }[]).map((v) => v.id);

  const { data: scheduled } = await sb
    .from("calendar_events")
    .select("videomaker_assigned_id")
    .eq("sub_calendar", "videomakers")
    .eq("videomaker_status", "scheduled")
    .in("videomaker_assigned_id", vmIds)
    .gte("inicio", now.toISOString())
    .lte("inicio", windowEnd.toISOString());

  const countMap = new Map<string, number>();
  for (const id of vmIds) countMap.set(id, 0);
  for (const row of (scheduled ?? []) as { videomaker_assigned_id: string }[]) {
    countMap.set(row.videomaker_assigned_id, (countMap.get(row.videomaker_assigned_id) ?? 0) + 1);
  }

  const candidates: VideomakerCandidate[] = (videomakers as { id: string; nome: string }[]).map((v) => ({
    id: v.id,
    nome: v.nome,
    scheduledCount: countMap.get(v.id) ?? 0,
  }));
  candidates.sort((a, b) => a.scheduledCount - b.scheduledCount);

  for (const candidate of candidates) {
    const { data: conflict } = await sb
      .from("calendar_events")
      .select("id")
      .eq("sub_calendar", "videomakers")
      .eq("videomaker_status", "scheduled")
      .eq("videomaker_assigned_id", candidate.id)
      .lt("inicio", event.fim)
      .gt("fim", event.inicio)
      .limit(1)
      .maybeSingle();
    if (conflict) continue;

    const freelaMsg = await checarFreelaVideomaker({
      videomakerId: candidate.id,
      nome: candidate.nome,
      inicioUtc: event.inicio,
      fimUtc: event.fim,
    });
    if (freelaMsg) continue;

    const participantes = (event.participantes_ids as string[] | null) ?? [];
    const novosParticipantes = participantes.includes(candidate.id)
      ? participantes
      : [...participantes, candidate.id];

    const { error } = await sb
      .from("calendar_events")
      .update({
        videomaker_assigned_id: candidate.id,
        videomaker_status: "scheduled",
        videomaker_delegado_por: actorId,
        videomaker_delegado_em: new Date().toISOString(),
        participantes_ids: novosParticipantes,
      })
      .eq("id", eventId)
      .eq("videomaker_status", "pending_delegation");
    if (error) {
      console.warn("[auto-delegate] update failed, skipping:", error.message);
      continue;
    }

    try {
      await dispatchNotification({
        evento_tipo: "task_assigned",
        titulo: "Captação delegada automaticamente",
        mensagem: `"${event.titulo}" foi atribuída a você`,
        link: `/calendario?event=${eventId}`,
        user_ids_extras: [candidate.id],
        source_user_id: actorId,
      });
    } catch {}

    await logAudit({
      entidade: "calendar_events",
      entidade_id: eventId,
      acao: "update",
      dados_depois: {
        acao: "auto_delegate_videomaker",
        videomaker_assigned_id: candidate.id,
      } as Record<string, unknown>,
      ator_id: actorId,
    });

    return; // delegou com sucesso
  }
}

// ─── Auto-delegação de edição a editor/videomaker ───────────────────────────

const DIAS_SEM_GRAVACAO_PARA_EDITAR = 5;

/**
 * Tenta auto-delegar a edição de uma captação recém-entregue.
 * Escolhe o editor (ou videomaker sem gravações próximas) com MENOS
 * tarefas de edição abertas.
 *
 * Best-effort: se falhar, a captação fica na fila manual.
 */
export async function autoAssignEditor(
  capturaId: string,
  actorId: string,
  actorNome: string,
): Promise<void> {
  try {
    await _autoAssignEditorImpl(capturaId, actorId, actorNome);
  } catch (e) {
    console.error("[auto-delegate] autoAssignEditor failed:", e);
  }
}

async function _autoAssignEditorImpl(
  capturaId: string,
  actorId: string,
  actorNome: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;

  const { data: captura } = await sb
    .from("audiovisual_capturas")
    .select(`
      id, client_id, drive_url, qtd_videos, qtd_fotos,
      pontos_positivos, pontos_dificuldade, sugestoes, observacoes,
      task_id, data_captacao,
      cliente:clients(id, nome, assessor_id)
    `)
    .eq("id", capturaId)
    .maybeSingle();
  if (!captura || captura.task_id) return;

  const { data: editores } = await sb
    .from("profiles")
    .select("id, nome, role")
    .in("role", ["editor", "videomaker", "fast_midia"])
    .eq("ativo", true);
  if (!editores || editores.length === 0) return;

  const editorIds = (editores as { id: string; nome: string; role: string }[]).map((e) => e.id);

  const { data: openTasks } = await sb
    .from("tasks")
    .select("atribuido_a")
    .in("atribuido_a", editorIds)
    .in("status", ["aberta", "em_andamento"]);

  const taskCount = new Map<string, number>();
  for (const id of editorIds) taskCount.set(id, 0);
  for (const row of (openTasks ?? []) as { atribuido_a: string }[]) {
    taskCount.set(row.atribuido_a, (taskCount.get(row.atribuido_a) ?? 0) + 1);
  }

  // Videomakers com gravação nos próximos N dias ficam FORA da edição
  const now = new Date();
  const vmCutoff = new Date(now.getTime() + DIAS_SEM_GRAVACAO_PARA_EDITAR * 24 * 60 * 60 * 1000);
  const vmIds = (editores as { id: string; role: string }[])
    .filter((e) => e.role === "videomaker" || e.role === "fast_midia")
    .map((e) => e.id);

  const busyVms = new Set<string>();
  if (vmIds.length > 0) {
    const { data: upcoming } = await sb
      .from("calendar_events")
      .select("videomaker_assigned_id")
      .eq("sub_calendar", "videomakers")
      .eq("videomaker_status", "scheduled")
      .in("videomaker_assigned_id", vmIds)
      .gte("inicio", now.toISOString())
      .lte("inicio", vmCutoff.toISOString());
    for (const row of (upcoming ?? []) as { videomaker_assigned_id: string }[]) {
      busyVms.add(row.videomaker_assigned_id);
    }
  }

  type Candidate = { id: string; nome: string; role: string; openTasks: number };
  const candidates: Candidate[] = (editores as { id: string; nome: string; role: string }[])
    .filter((e) => {
      if (e.role === "videomaker" || e.role === "fast_midia") {
        return !busyVms.has(e.id);
      }
      return true;
    })
    .map((e) => ({
      id: e.id,
      nome: e.nome,
      role: e.role,
      openTasks: taskCount.get(e.id) ?? 0,
    }));
  // Editores primeiro (são dedicados a edição), depois videomakers livres
  candidates.sort((a, b) => {
    const aIsEditor = a.role === "editor" ? 0 : 1;
    const bIsEditor = b.role === "editor" ? 0 : 1;
    if (aIsEditor !== bIsEditor) return aIsEditor - bIsEditor;
    return a.openTasks - b.openTasks;
  });

  if (candidates.length === 0) return;

  const chosen = candidates[0];

  const clienteNome = captura.cliente?.nome ?? "";
  const dataBr = captura.data_captacao
    ? new Date(captura.data_captacao + "T12:00:00Z").toLocaleDateString("pt-BR")
    : "";
  const titulo = `Editar: ${clienteNome}${dataBr ? ` (${dataBr})` : ""}`;

  const descricaoLines: string[] = [];
  descricaoLines.push(`📹 ${captura.qtd_videos} vídeo(s) · 📷 ${captura.qtd_fotos} foto(s)`);
  if (captura.drive_url) descricaoLines.push(`Drive: ${captura.drive_url}`);
  if (captura.pontos_positivos) descricaoLines.push(`✅ Positivos: ${captura.pontos_positivos}`);
  if (captura.pontos_dificuldade) descricaoLines.push(`⚠️ Dificuldades: ${captura.pontos_dificuldade}`);
  if (captura.sugestoes) descricaoLines.push(`💡 Sugestões: ${captura.sugestoes}`);
  if (captura.observacoes) descricaoLines.push(`Obs.: ${captura.observacoes}`);
  const descricao = descricaoLines.join("\n\n");

  // Due date: 5 dias úteis a partir de hoje (pula sáb/dom)
  const dueDate = addBusinessDays(now, 5);

  const coordenadoresAv = await getCoordenadoresAudiovisualIds();
  const assessorId: string | null = captura.cliente?.assessor_id ?? null;
  const participantesAuto = [
    ...coordenadoresAv,
    ...(assessorId ? [assessorId] : []),
  ].filter(
    (id, i, arr) => id !== chosen.id && id !== actorId && arr.indexOf(id) === i,
  );

  const { data: createdTask, error: taskErr } = await sb
    .from("tasks")
    .insert({
      titulo,
      descricao,
      prioridade: "media",
      status: "aberta",
      atribuido_a: chosen.id,
      criado_por: actorId,
      client_id: captura.client_id,
      due_date: dueDate,
      participantes_ids: participantesAuto,
    })
    .select("id")
    .single();
  if (taskErr || !createdTask) {
    console.error("[auto-delegate] task insert failed:", taskErr?.message);
    return;
  }

  const { error: linkErr } = await sb
    .from("audiovisual_capturas")
    .update({ task_id: createdTask.id })
    .eq("id", capturaId);
  if (linkErr) {
    console.error("[auto-delegate] captura link failed:", linkErr.message);
    return;
  }

  try {
    await dispatchNotification({
      evento_tipo: "task_assigned",
      titulo: `Nova edição: ${clienteNome}`,
      mensagem: `Edição delegada automaticamente a você por ${actorNome}`,
      link: `/tarefas/${createdTask.id}`,
      user_ids_extras: [chosen.id],
      source_user_id: actorId,
    });
  } catch {}

  await logAudit({
    entidade: "audiovisual_capturas",
    entidade_id: capturaId,
    acao: "update",
    dados_depois: {
      acao: "auto_delegate_editor",
      task_id: createdTask.id,
      editor_id: chosen.id,
    } as Record<string, unknown>,
    ator_id: actorId,
  });
}

function addBusinessDays(from: Date, days: number): string {
  const d = new Date(from);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d.toISOString().slice(0, 10);
}
