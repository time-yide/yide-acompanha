import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
import { logAudit } from "@/lib/audit/log";
import { checarFreelaVideomaker } from "@/lib/calendario/freela-check";
import { getCoordenadoresAudiovisualIds } from "@/lib/tarefas/client-team";
import { escolherEditor } from "./escolher-editor";
import { carregarCapturaParaEdicao, criarTarefasEdicao } from "./tarefas-edicao";
import { formatYmdBr } from "./edicao-urgente";

// ─── Auto-delegação de videomaker a gravação ────────────────────────────────

const NOMES_RODIZIO_GRAVACAO = ["Icaro Pinheiro", "Locatelli"];

interface VideomakerCandidate {
  id: string;
  nome: string;
  scheduledCount: number;
}

export type AutoAssignVideomakerResult =
  | "delegada"
  | "sem_candidato" // ninguém do rodízio livre no horário
  | "ignorada"; // evento não existe / não é gravação / não está pendente

/**
 * Tenta auto-delegar um videomaker a um evento pending_delegation.
 * Escolhe o videomaker ativo com MENOS gravações agendadas nos próximos
 * 30 dias e sem conflito de horário/freela.
 *
 * Roda ao criar, editar e remarcar a gravação, e de novo pelo cron
 * `audiovisual-auto-delegar-gravacao` (pega o que ficou pra trás).
 *
 * `avisarSeFalhar`: se ninguém do rodízio estiver livre, avisa os
 * coordenadores do audiovisual pra delegarem na mão. O cron não avisa
 * (senão repetiria o aviso a cada execução).
 *
 * Best-effort: se falhar, o evento fica pending_delegation pro manual.
 */
export async function autoAssignVideomaker(
  eventId: string,
  actorId: string | null,
  opts: { avisarSeFalhar?: boolean } = {},
): Promise<AutoAssignVideomakerResult> {
  try {
    const res = await _autoAssignVideomakerImpl(eventId, actorId);
    if (res.resultado === "sem_candidato" && opts.avisarSeFalhar && res.event) {
      await avisarGravacaoSemVideomaker(res.event, actorId);
    }
    return res.resultado;
  } catch (e) {
    console.error("[auto-delegate] autoAssignVideomaker failed:", e);
    return "ignorada";
  }
}

interface EventoGravacao {
  id: string;
  titulo: string;
  inicio: string;
  fim: string;
  sub_calendar: string;
  videomaker_status: string | null;
  participantes_ids: string[] | null;
}

async function avisarGravacaoSemVideomaker(
  event: EventoGravacao,
  actorId: string | null,
): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createServiceRoleClient() as any;
    const { data: coords } = await sb
      .from("profiles")
      .select("id")
      .in("role", ["audiovisual_chefe", "socio"])
      .eq("ativo", true);
    const ids = ((coords ?? []) as { id: string }[]).map((c) => c.id);
    if (ids.length === 0) return;
    const quando = new Date(event.inicio).toLocaleString("pt-BR", {
      timeZone: "America/Cuiaba",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    await dispatchNotification({
      evento_tipo: "task_assigned",
      titulo: "Gravação sem videomaker",
      mensagem: `Ninguém do rodízio está livre em "${event.titulo}" (${quando}). Delegue manualmente.`,
      link: "/audiovisual?tab=aguardando_videomaker",
      user_ids_extras: ids,
      ...(actorId ? { source_user_id: actorId } : {}),
    });
  } catch (e) {
    console.error("[auto-delegate] aviso gravação sem videomaker falhou:", e);
  }
}

async function _autoAssignVideomakerImpl(
  eventId: string,
  actorId: string | null,
): Promise<{ resultado: AutoAssignVideomakerResult; event?: EventoGravacao }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;

  const { data: event } = await sb
    .from("calendar_events")
    .select("id, titulo, inicio, fim, sub_calendar, videomaker_status, participantes_ids")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return { resultado: "ignorada" };
  if (event.sub_calendar !== "videomakers") return { resultado: "ignorada" };
  if (event.videomaker_status !== "pending_delegation") return { resultado: "ignorada" };

  const { data: allProfiles } = await sb
    .from("profiles")
    .select("id, nome")
    .eq("ativo", true);
  const videomakers = (allProfiles ?? []).filter((p: { nome: string }) =>
    NOMES_RODIZIO_GRAVACAO.some((n) => p.nome?.includes(n)),
  );
  if (videomakers.length === 0) return { resultado: "sem_candidato", event };

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

    const { data: atualizados, error } = await sb
      .from("calendar_events")
      .update({
        videomaker_assigned_id: candidate.id,
        videomaker_status: "scheduled",
        videomaker_delegado_por: actorId,
        videomaker_delegado_em: new Date().toISOString(),
        participantes_ids: novosParticipantes,
      })
      .eq("id", eventId)
      .eq("videomaker_status", "pending_delegation")
      .select("id");
    if (error) {
      console.warn("[auto-delegate] update failed, skipping:", error.message);
      continue;
    }
    // 0 linhas = outra delegação (manual ou cron) chegou antes. Não notifica.
    if (!atualizados || atualizados.length === 0) return { resultado: "ignorada" };

    try {
      await dispatchNotification({
        evento_tipo: "task_assigned",
        titulo: "Captação delegada automaticamente",
        mensagem: `"${event.titulo}" foi atribuída a você`,
        link: `/calendario?event=${eventId}`,
        user_ids_extras: [candidate.id],
        ...(actorId ? { source_user_id: actorId } : {}),
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
      ...(actorId ? {} : { justificativa: "cron audiovisual-auto-delegar-gravacao" }),
    });

    return { resultado: "delegada" }; // delegou com sucesso
  }
  return { resultado: "sem_candidato", event };
}

// ─── Auto-delegação de edição a editor/videomaker ───────────────────────────

const DIAS_GRAVACAO_PROXIMA = 5;

/**
 * Tenta auto-delegar a edição de uma captação recém-entregue.
 * Rodízio entre editores/videomakers: vai pra quem tem MENOS tarefas abertas
 * (ver escolherEditor).
 *
 * Best-effort: se falhar, a captação fica na fila manual.
 */
export async function autoAssignEditor(
  capturaId: string,
  actorId: string,
  actorNome: string,
  opts: { sistema?: boolean } = {},
): Promise<void> {
  try {
    await _autoAssignEditorImpl(capturaId, actorId, actorNome, opts.sistema ?? false);
  } catch (e) {
    console.error("[auto-delegate] autoAssignEditor failed:", e);
  }
}

async function _autoAssignEditorImpl(
  capturaId: string,
  actorId: string,
  actorNome: string,
  sistema: boolean,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;

  const captura = await carregarCapturaParaEdicao(sb, capturaId);
  if (!captura || captura.task_id || captura.concluida_em) return;

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
    .in("status", ["aberta", "em_andamento", "alteracao"]);

  const taskCount = new Map<string, number>();
  for (const id of editorIds) taskCount.set(id, 0);
  for (const row of (openTasks ?? []) as { atribuido_a: string }[]) {
    taskCount.set(row.atribuido_a, (taskCount.get(row.atribuido_a) ?? 0) + 1);
  }

  // Gravação nos próximos N dias só pesa no desempate (não tira ninguém da roda).
  const now = new Date();
  const vmCutoff = new Date(now.getTime() + DIAS_GRAVACAO_PROXIMA * 24 * 60 * 60 * 1000);
  const busyVms = new Set<string>();
  const { data: upcoming } = await sb
    .from("calendar_events")
    .select("videomaker_assigned_id")
    .eq("sub_calendar", "videomakers")
    .eq("videomaker_status", "scheduled")
    .in("videomaker_assigned_id", editorIds)
    .gte("inicio", now.toISOString())
    .lte("inicio", vmCutoff.toISOString());
  for (const row of (upcoming ?? []) as { videomaker_assigned_id: string }[]) {
    busyVms.add(row.videomaker_assigned_id);
  }

  const chosen = escolherEditor(
    (editores as { id: string; nome: string; role: string }[]).map((e) => ({
      id: e.id,
      nome: e.nome ?? "",
      role: e.role,
      tarefasAbertas: taskCount.get(e.id) ?? 0,
      temGravacaoProxima: busyVms.has(e.id),
    })),
  );
  if (!chosen) return;

  const clienteNome = captura.cliente?.nome ?? "";

  const coordenadoresAv = await getCoordenadoresAudiovisualIds();
  const assessorId: string | null = captura.cliente?.assessor_id ?? null;
  const participantesAuto = [
    ...coordenadoresAv,
    ...(assessorId ? [assessorId] : []),
  ].filter(
    (id, i, arr) => id !== chosen.id && id !== actorId && arr.indexOf(id) === i,
  );

  // Prazo fixo de 3 dias úteis da gravação; com edição urgente nascem 2 tarefas.
  const result = await criarTarefasEdicao(sb, captura, {
    atribuido_a: chosen.id,
    criado_por: actorId,
    participantes_ids: participantesAuto,
  });
  if (!result.ok) {
    // corrida = outra delegação ganhou; o resto é erro real.
    if (!result.corrida) console.error("[auto-delegate] criar tarefas falhou:", result.error);
    return;
  }
  const createdTask = { id: result.taskUrgenteId ?? result.taskId };

  if (result.taskUrgenteId) {
    await avisarEdicaoUrgente({
      taskUrgenteId: result.taskUrgenteId,
      clienteNome,
      editorNome: chosen.nome,
      dueDate: result.planos.find((p) => p.tipo === "urgente")?.due_date ?? null,
      destinatarios: [...coordenadoresAv, ...(assessorId ? [assessorId] : [])],
      sistema,
      actorId,
    });
  }

  try {
    await dispatchNotification({
      evento_tipo: "task_assigned",
      titulo: `Nova edição: ${clienteNome}`,
      mensagem: result.taskUrgenteId
        ? `Edição delegada automaticamente a você por ${actorNome} — tem vídeo URGENTE`
        : `Edição delegada automaticamente a você por ${actorNome}`,
      link: `/tarefas/${createdTask.id}`,
      user_ids_extras: [chosen.id],
      ...(sistema ? {} : { source_user_id: actorId }),
    });
  } catch {}

  await logAudit({
    entidade: "audiovisual_capturas",
    entidade_id: capturaId,
    acao: "update",
    dados_depois: {
      acao: "auto_delegate_editor",
      task_id: result.taskId,
      task_urgente_id: result.taskUrgenteId,
      editor_id: chosen.id,
    } as Record<string, unknown>,
    ator_id: sistema ? null : actorId,
    ...(sistema ? { justificativa: "cron audiovisual-auto-delegar-edicao" } : {}),
  });
}

/**
 * Avisa assessor do cliente + coordenadores audiovisuais que nasceu uma
 * edição urgente (notificação com prioridade "urgente"). Best-effort.
 */
export async function avisarEdicaoUrgente(args: {
  taskUrgenteId: string;
  clienteNome: string;
  editorNome: string;
  dueDate: string | null;
  destinatarios: string[];
  sistema: boolean;
  actorId: string;
}): Promise<void> {
  const ids = [...new Set(args.destinatarios)].filter((id) => args.sistema || id !== args.actorId);
  if (ids.length === 0) return;
  try {
    await dispatchNotification({
      evento_tipo: "task_assigned",
      titulo: `Edição URGENTE: ${args.clienteNome}`,
      mensagem: `${args.editorNome} ficou com a edição urgente${args.dueDate ? ` (até ${formatYmdBr(args.dueDate)})` : ""}.`,
      link: `/tarefas/${args.taskUrgenteId}`,
      user_ids_extras: ids,
      prioridade: "urgente",
      ...(args.sistema ? {} : { source_user_id: args.actorId }),
    });
  } catch (e) {
    console.error("[auto-delegate] aviso edição urgente falhou:", e);
  }
}
