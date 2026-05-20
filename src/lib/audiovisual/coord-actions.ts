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
