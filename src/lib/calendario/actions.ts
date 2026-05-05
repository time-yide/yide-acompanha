"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
import {
  createEventSchema,
  editEventSchema,
  ROLES_PODEM_CRIAR_VIDEOMAKER,
  type SelectableSub,
  SELECTABLE_SUBS,
} from "./schema";

function fd(formData: FormData, key: string) {
  const v = formData.get(key);
  return v === null || v === "" ? undefined : String(v);
}

/**
 * Dispara notificação pra cada participante recém-marcado num evento.
 * Pula o próprio actor (não notifica quem criou/editou). Best-effort:
 * falha silenciosa pra não impedir o save do evento.
 */
async function notifyCalendarParticipants(params: {
  eventId: string;
  titulo: string;
  inicio: string;
  participantesNovos: string[];
  actorId: string;
  actorNome: string;
}): Promise<void> {
  const recipients = params.participantesNovos.filter((id) => id !== params.actorId);
  if (recipients.length === 0) return;

  const dataFmt = new Date(params.inicio).toLocaleString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  try {
    await dispatchNotification({
      // Cast: enum value adicionado em migration nova; types serão regerados
      // após `npm run db:types` pós-merge da migration.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      evento_tipo: "evento_calendario_marcado" as any,
      titulo: "Você foi adicionado em um evento",
      mensagem: `${params.actorNome} adicionou você no evento "${params.titulo}" — ${dataFmt}`,
      link: `/calendario/${params.eventId}`,
      user_ids_extras: recipients,
      source_user_id: params.actorId,
    });
  } catch {
    // Falha de notificação não deve impedir o save do evento.
  }
}

function parseSub(raw: string | undefined): SelectableSub {
  if (raw && (SELECTABLE_SUBS as readonly string[]).includes(raw)) {
    return raw as SelectableSub;
  }
  return "agencia";
}

function canCreateVideomaker(role: string): boolean {
  return (ROLES_PODEM_CRIAR_VIDEOMAKER as readonly string[]).includes(role);
}

type ActionResult = { error?: string } | undefined;

export async function createEventAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();

  const participantesRaw = formData.getAll("participantes_ids") as string[];
  const sub = parseSub(fd(formData, "sub_calendar"));

  if (sub === "videomakers" && !canCreateVideomaker(actor.role)) {
    return { error: "Apenas Sócio, ADM, Coordenador ou Assessor podem criar eventos de videomaker" };
  }

  const parsed = createEventSchema.safeParse({
    titulo: fd(formData, "titulo"),
    descricao: fd(formData, "descricao"),
    inicio: fd(formData, "inicio"),
    fim: fd(formData, "fim"),
    participantes_ids: participantesRaw.filter(Boolean),
    sub_calendar: sub,
    localizacao_endereco: fd(formData, "localizacao_endereco"),
    localizacao_maps_url: fd(formData, "localizacao_maps_url"),
    link_roteiro: fd(formData, "link_roteiro"),
    observacoes_gravacao: fd(formData, "observacoes_gravacao"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  if (new Date(parsed.data.fim) <= new Date(parsed.data.inicio)) {
    return { error: "Horário de fim deve ser posterior ao início" };
  }

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").limit(1).single();
  if (!org) return { error: "Organização não encontrada" };

  const insertPayload = {
    organization_id: org.id,
    titulo: parsed.data.titulo,
    descricao: parsed.data.descricao || null,
    inicio: parsed.data.inicio,
    fim: parsed.data.fim,
    sub_calendar: parsed.data.sub_calendar,
    criado_por: actor.id,
    participantes_ids: parsed.data.participantes_ids,
    localizacao_endereco: parsed.data.localizacao_endereco?.trim() || null,
    localizacao_maps_url: parsed.data.localizacao_maps_url?.trim() || null,
    link_roteiro: parsed.data.link_roteiro?.trim() || null,
    observacoes_gravacao: parsed.data.observacoes_gravacao?.trim() || null,
  };

  const { data: created, error } = await supabase
    .from("calendar_events")
    .insert(insertPayload)
    .select("id")
    .single();
  if (error || !created) return { error: error?.message ?? "Falha ao criar evento" };

  await logAudit({
    entidade: "calendar_events",
    entidade_id: created.id,
    acao: "create",
    dados_depois: insertPayload as unknown as Record<string, unknown>,
    ator_id: actor.id,
  });

  // Notifica os participantes do evento novo (exceto o próprio criador)
  await notifyCalendarParticipants({
    eventId: created.id,
    titulo: parsed.data.titulo,
    inicio: parsed.data.inicio,
    participantesNovos: parsed.data.participantes_ids,
    actorId: actor.id,
    actorNome: actor.nome,
  });

  revalidatePath("/calendario");
  redirect(`/calendario`);
}

export async function updateEventAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  const id = String(formData.get("id"));

  const supabase = await createClient();
  const { data: before } = await supabase.from("calendar_events").select("*").eq("id", id).single();
  if (!before) return { error: "Evento não encontrado" };

  const participantesRaw = formData.getAll("participantes_ids") as string[];
  const sub = parseSub(fd(formData, "sub_calendar"));

  if (sub === "videomakers" && !canCreateVideomaker(actor.role)) {
    return { error: "Apenas Sócio, ADM, Coordenador ou Assessor podem editar eventos de videomaker" };
  }

  const parsed = editEventSchema.safeParse({
    id,
    titulo: fd(formData, "titulo"),
    descricao: fd(formData, "descricao"),
    inicio: fd(formData, "inicio"),
    fim: fd(formData, "fim"),
    participantes_ids: participantesRaw.filter(Boolean),
    sub_calendar: sub,
    localizacao_endereco: fd(formData, "localizacao_endereco"),
    localizacao_maps_url: fd(formData, "localizacao_maps_url"),
    link_roteiro: fd(formData, "link_roteiro"),
    observacoes_gravacao: fd(formData, "observacoes_gravacao"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  if (new Date(parsed.data.fim) <= new Date(parsed.data.inicio)) {
    return { error: "Horário de fim deve ser posterior ao início" };
  }

  const updatePayload = {
    titulo: parsed.data.titulo,
    descricao: parsed.data.descricao || null,
    inicio: parsed.data.inicio,
    fim: parsed.data.fim,
    sub_calendar: parsed.data.sub_calendar,
    participantes_ids: parsed.data.participantes_ids,
    localizacao_endereco: parsed.data.localizacao_endereco?.trim() || null,
    localizacao_maps_url: parsed.data.localizacao_maps_url?.trim() || null,
    link_roteiro: parsed.data.link_roteiro?.trim() || null,
    observacoes_gravacao: parsed.data.observacoes_gravacao?.trim() || null,
  };

  const { error } = await supabase.from("calendar_events").update(updatePayload).eq("id", id);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "calendar_events",
    entidade_id: id,
    acao: "update",
    dados_antes: before as unknown as Record<string, unknown>,
    dados_depois: updatePayload as unknown as Record<string, unknown>,
    ator_id: actor.id,
  });

  // Notifica APENAS os participantes que foram adicionados nesta edição
  // (não re-notifica quem já estava). Compara before vs new.
  const participantesAntes = ((before as unknown as { participantes_ids: string[] | null })
    .participantes_ids ?? []);
  const adicionados = parsed.data.participantes_ids.filter(
    (pid) => !participantesAntes.includes(pid),
  );
  if (adicionados.length > 0) {
    await notifyCalendarParticipants({
      eventId: id,
      titulo: parsed.data.titulo,
      inicio: parsed.data.inicio,
      participantesNovos: adicionados,
      actorId: actor.id,
      actorNome: actor.nome,
    });
  }

  revalidatePath("/calendario");
  revalidatePath(`/calendario/${id}`);
  redirect("/calendario");
}

export async function deleteEventAction(eventId: string) {
  const actor = await requireAuth();
  const supabase = await createClient();
  const { error } = await supabase.from("calendar_events").delete().eq("id", eventId);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "calendar_events",
    entidade_id: eventId,
    acao: "soft_delete",
    ator_id: actor.id,
  });

  revalidatePath("/calendario");
  return { success: "Evento removido" };
}
