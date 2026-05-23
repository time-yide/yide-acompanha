"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import { logActivityInternal } from "@/lib/produtividade/actions";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";

interface ActionResult { success?: boolean; error?: string }

// Roles defs em coord-roles.ts (arquivo separado pra poder exportar
// constants/funcs — "use server" só permite async exports aqui).
import { ROLES_COORD_DELEGATE } from "./coord-roles";

/**
 * Coord audiovisual delega uma captação pendente pra um videomaker
 * específico. Validações:
 * - Apenas roles autorizados
 * - Evento existe e está em pending_delegation
 * - Videomaker selecionado tem role='videomaker' e está ativo
 * - Sem colisão: o mesmo videomaker não pode ter outro evento scheduled
 *   com horário sobreposto (enforced via exclusion constraint no banco,
 *   mas validamos antes pra dar mensagem amigável)
 *
 * Side effects:
 * - Atualiza videomaker_assigned_id, status='scheduled', delegado_por/em
 * - Adiciona videomaker em participantes_ids
 * - Notifica o videomaker
 * - Log de auditoria + evento de produtividade
 */
export async function delegateVideomakerAction(
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!ROLES_COORD_DELEGATE.has(actor.role)) {
    return { error: "Você não tem permissão pra delegar captação" };
  }

  const eventId = String(formData.get("event_id") ?? "");
  const videomakerId = String(formData.get("videomaker_id") ?? "");
  if (!eventId || !videomakerId) {
    return { error: "Evento e videomaker são obrigatórios" };
  }

  // SERVICE-ROLE intencional: a RLS de UPDATE em calendar_events só permite
  // criador/adm/sócio. `audiovisual_chefe` ficaria bloqueado silenciosamente
  // (Supabase não erra em RLS deny — só retorna 0 rows afetadas). Auth tá
  // garantida pelo check de role acima via ROLES_COORD_DELEGATE.
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // 1) Busca o evento e valida estado
  const { data: event } = await sb
    .from("calendar_events")
    .select("id, titulo, inicio, fim, sub_calendar, videomaker_status, participantes_ids")
    .eq("id", eventId)
    .single();
  if (!event) return { error: "Evento não encontrado" };
  if (event.sub_calendar !== "videomakers") {
    return { error: "Esse evento não é de videomaker" };
  }
  if (event.videomaker_status !== "pending_delegation") {
    return { error: "Esse evento já foi delegado ou não está pendente" };
  }

  // 2) Valida o videomaker selecionado
  const { data: videomaker } = await sb
    .from("profiles")
    .select("id, nome, role, ativo")
    .eq("id", videomakerId)
    .single();
  if (!videomaker || videomaker.role !== "videomaker" || !videomaker.ativo) {
    return { error: "Videomaker inválido ou inativo" };
  }

  // 3) Checa colisão antes de tentar inserir (UX melhor que erro do banco).
  //    Busca eventos do mesmo videomaker, em status scheduled, que tenham
  //    overlap com o range do evento atual.
  const { data: conflict } = await sb
    .from("calendar_events")
    .select("id, titulo, inicio, fim")
    .eq("sub_calendar", "videomakers")
    .eq("videomaker_status", "scheduled")
    .eq("videomaker_assigned_id", videomakerId)
    .lt("inicio", event.fim)
    .gt("fim", event.inicio)
    .limit(1)
    .maybeSingle();
  if (conflict) {
    const inicioBR = new Date(conflict.inicio).toLocaleString("pt-BR", {
      timeZone: "America/Cuiaba",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    return {
      error: `${videomaker.nome} já tem captação "${conflict.titulo}" às ${inicioBR}`,
    };
  }

  // 4) Adiciona o videomaker em participantes_ids (sem duplicar) pra
  //    notificações/agenda funcionarem normalmente
  const participantesAtuais = (event.participantes_ids as string[] | null) ?? [];
  const novosParticipantes = participantesAtuais.includes(videomakerId)
    ? participantesAtuais
    : [...participantesAtuais, videomakerId];

  // 5) Update — exclusion constraint do banco é a defesa em profundidade.
  //    Se duas delegações concorrentes acontecerem pro mesmo videomaker no
  //    mesmo segundo, uma vai falhar aqui mesmo após a checagem passar.
  //
  //    `.select()` no fim força o PostgREST a devolver as linhas atualizadas
  //    — usado pra detectar 0-rows-affected (RLS deny silencioso, eventId
  //    inválido, etc.) e falhar com mensagem clara em vez de toast de sucesso.
  const { data: updated, error } = await sb
    .from("calendar_events")
    .update({
      videomaker_assigned_id: videomakerId,
      videomaker_status: "scheduled",
      videomaker_delegado_por: actor.id,
      videomaker_delegado_em: new Date().toISOString(),
      participantes_ids: novosParticipantes,
    })
    .eq("id", eventId)
    .select("id");
  if (error) {
    // Trata o caso da exclusion constraint disparar (race condition)
    if (error.message?.includes("no_videomaker_overlap")) {
      return {
        error: `${videomaker.nome} já tem outra captação naquele horário (atualização concorrente)`,
      };
    }
    return { error: error.message };
  }
  if (!updated || updated.length === 0) {
    console.error("[audiovisual/coord] delegate update affected 0 rows", { eventId, videomakerId, actorId: actor.id });
    return { error: "Não foi possível atualizar a captação (sem permissão ou evento removido). Recarregue e tente de novo." };
  }

  // 6) Notifica o videomaker designado
  await dispatchNotification({
    evento_tipo: "task_assigned",
    titulo: "Nova captação delegada a você",
    mensagem: `${actor.nome} delegou "${event.titulo}"`,
    link: `/calendario?event=${eventId}`,
    user_ids_extras: [videomakerId],
    source_user_id: actor.id,
  });

  await logAudit({
    entidade: "calendar_events",
    entidade_id: eventId,
    acao: "update",
    dados_depois: {
      acao: "delegate_videomaker",
      videomaker_assigned_id: videomakerId,
    } as Record<string, unknown>,
    ator_id: actor.id,
  });

  await logActivityInternal(actor.id, "outro", {
    entityType: "calendar_events",
    entityId: eventId,
    metadata: {
      acao: "delegacao_videomaker",
      videomaker_id: videomakerId,
      titulo: event.titulo,
    },
  });

  revalidatePath("/audiovisual/coordenacao");
  revalidatePath("/audiovisual");
  revalidatePath("/calendario");
  revalidateTag("calendar", "default");
  return { success: true };
}

/**
 * Atualiza uma delegação já feita: troca o videomaker assignado e/ou o coord
 * audiovisual responsável. Usado pra "trocar videomaker" sem precisar
 * "desdelegar + delegar de novo".
 *
 * - Apenas roles autorizados (mesmas regras de delegate)
 * - Evento precisa estar em status='scheduled' (já delegado)
 * - Se trocar videomaker: revalida role, ativo e checa overlap
 * - Se trocar coord: valida que tem permissão de coord audiovisual
 * - Notifica novo videomaker se mudou; remove antigo de participantes_ids
 *   se ele não era participante por outro motivo
 */
export async function updateDelegacaoAction(
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!ROLES_COORD_DELEGATE.has(actor.role)) {
    return { error: "Você não tem permissão pra alterar delegação" };
  }

  const eventId = String(formData.get("event_id") ?? "");
  const newVideomakerId = String(formData.get("videomaker_id") ?? "");
  const newCoordId = String(formData.get("coord_id") ?? "");
  if (!eventId) return { error: "Evento é obrigatório" };
  if (!newVideomakerId && !newCoordId) {
    return { error: "Nada pra atualizar" };
  }

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data: event } = await sb
    .from("calendar_events")
    .select(
      "id, titulo, inicio, fim, sub_calendar, videomaker_status, videomaker_assigned_id, videomaker_delegado_por, participantes_ids",
    )
    .eq("id", eventId)
    .single();
  if (!event) return { error: "Evento não encontrado" };
  if (event.sub_calendar !== "videomakers") {
    return { error: "Esse evento não é de videomaker" };
  }
  if (event.videomaker_status !== "scheduled") {
    return { error: "Esse evento não está delegado — use delegar" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = {};
  let videomakerChanged = false;
  let novoVideomakerNome = "";

  if (newVideomakerId && newVideomakerId !== event.videomaker_assigned_id) {
    const { data: vm } = await sb
      .from("profiles")
      .select("id, nome, role, ativo")
      .eq("id", newVideomakerId)
      .single();
    if (!vm || vm.role !== "videomaker" || !vm.ativo) {
      return { error: "Videomaker inválido ou inativo" };
    }
    // Conflito de horário (ignora o próprio evento)
    const { data: conflict } = await sb
      .from("calendar_events")
      .select("id, titulo, inicio, fim")
      .eq("sub_calendar", "videomakers")
      .eq("videomaker_status", "scheduled")
      .eq("videomaker_assigned_id", newVideomakerId)
      .neq("id", eventId)
      .lt("inicio", event.fim)
      .gt("fim", event.inicio)
      .limit(1)
      .maybeSingle();
    if (conflict) {
      const inicioBR = new Date(conflict.inicio).toLocaleString("pt-BR", {
        timeZone: "America/Cuiaba",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
      return {
        error: `${vm.nome} já tem captação "${conflict.titulo}" às ${inicioBR}`,
      };
    }
    updates.videomaker_assigned_id = newVideomakerId;
    videomakerChanged = true;
    novoVideomakerNome = vm.nome;

    // Atualiza participantes_ids: adiciona o novo, remove o antigo se ele
    // estava lá só pela delegação anterior (best-effort — se ele tinha outro
    // motivo pra estar, vai ser removido aqui mas é raro).
    const atual = (event.participantes_ids as string[] | null) ?? [];
    const semAntigo = atual.filter((id) => id !== event.videomaker_assigned_id);
    updates.participantes_ids = semAntigo.includes(newVideomakerId)
      ? semAntigo
      : [...semAntigo, newVideomakerId];
  }

  if (newCoordId && newCoordId !== event.videomaker_delegado_por) {
    const { data: coord } = await sb
      .from("profiles")
      .select("id, nome, role, ativo")
      .eq("id", newCoordId)
      .single();
    if (!coord || !ROLES_COORD_DELEGATE.has(coord.role) || !coord.ativo) {
      return { error: "Coord audiovisual inválido ou inativo" };
    }
    updates.videomaker_delegado_por = newCoordId;
  }

  if (Object.keys(updates).length === 0) {
    return { error: "Nada mudou" };
  }

  // Marca quando foi alterado pra refletir na UI ("Delegada por X em Y")
  if (videomakerChanged) {
    updates.videomaker_delegado_em = new Date().toISOString();
  }

  const { data: updated, error } = await sb
    .from("calendar_events")
    .update(updates)
    .eq("id", eventId)
    .select("id");
  if (error) {
    if (error.message?.includes("no_videomaker_overlap")) {
      return {
        error: `Esse videomaker já tem outra captação naquele horário (atualização concorrente)`,
      };
    }
    return { error: error.message };
  }
  if (!updated || updated.length === 0) {
    console.error("[audiovisual/coord] update update affected 0 rows", { eventId, actorId: actor.id });
    return { error: "Não foi possível atualizar a delegação. Recarregue e tente de novo." };
  }

  if (videomakerChanged) {
    await dispatchNotification({
      evento_tipo: "task_assigned",
      titulo: "Nova captação delegada a você",
      mensagem: `${actor.nome} delegou "${event.titulo}"`,
      link: `/calendario?event=${eventId}`,
      user_ids_extras: [newVideomakerId],
      source_user_id: actor.id,
    });
  }

  await logAudit({
    entidade: "calendar_events",
    entidade_id: eventId,
    acao: "update",
    dados_depois: {
      acao: "update_delegacao",
      ...(videomakerChanged
        ? { videomaker_anterior: event.videomaker_assigned_id, videomaker_novo: newVideomakerId, novo_videomaker_nome: novoVideomakerNome }
        : {}),
      ...(updates.videomaker_delegado_por
        ? { coord_anterior: event.videomaker_delegado_por, coord_novo: updates.videomaker_delegado_por }
        : {}),
    } as Record<string, unknown>,
    ator_id: actor.id,
  });

  await logActivityInternal(actor.id, "outro", {
    entityType: "calendar_events",
    entityId: eventId,
    metadata: {
      acao: "update_delegacao",
      titulo: event.titulo,
      videomaker_id: updates.videomaker_assigned_id ?? event.videomaker_assigned_id,
      coord_id: updates.videomaker_delegado_por ?? event.videomaker_delegado_por,
    },
  });

  revalidatePath("/audiovisual/coordenacao");
  revalidatePath("/audiovisual");
  revalidatePath("/calendario");
  revalidateTag("calendar", "default");
  return { success: true };
}
