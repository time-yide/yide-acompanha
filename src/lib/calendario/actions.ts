"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
import { brtInputToUtcIso } from "./timezone";
import { APP_TIMEZONE } from "@/lib/datetime/timezone";
import {
  createEventSchema,
  editEventSchema,
  comParticipanteVideomaker,
  ROLES_PODEM_CRIAR_VIDEOMAKER,
  type SelectableSub,
  SELECTABLE_SUBS,
} from "./schema";
import { canRoleDelegateVideomaker, isVideomakerObrigatorioParaRole } from "@/lib/audiovisual/coord-roles";
import { checarBloqueioVideomaker } from "./bloqueio-check";

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
    timeZone: APP_TIMEZONE,
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
      mensagem: `${params.actorNome} adicionou você no evento "${params.titulo}" · ${dataFmt}`,
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

/**
 * Valida que `videomakerId` é um videomaker ativo e não tem captação scheduled
 * com horário sobreposto a [inicioUtc, fimUtc]. `excludeEventId` ignora o
 * próprio evento (usado na edição). Espelha delegateVideomakerAction.
 * Inputs de horário são ISO UTC.
 */
async function validateVideomakerAssignment(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  params: {
    videomakerId: string;
    inicioUtc: string;
    fimUtc: string;
    excludeEventId?: string;
    dataLocal: string;
    horaInicioLocal: string;
    horaFimLocal: string;
    ignorarBloqueio?: boolean;
  },
): Promise<{ error: string } | { blockWarning: string } | { ok: true; nome: string }> {
  const { data: vm } = await sb
    .from("profiles")
    .select("id, nome, role, ativo")
    .eq("id", params.videomakerId)
    .single();
  if (!vm || !["videomaker", "fast_midia"].includes(vm.role) || !vm.ativo) {
    return { error: "Videomaker inválido ou inativo" };
  }

  let q = sb
    .from("calendar_events")
    .select("id, titulo, inicio, fim")
    .eq("sub_calendar", "videomakers")
    .eq("videomaker_status", "scheduled")
    .eq("videomaker_assigned_id", params.videomakerId)
    .lt("inicio", params.fimUtc)
    .gt("fim", params.inicioUtc);
  if (params.excludeEventId) q = q.neq("id", params.excludeEventId);
  const { data: conflict } = await q.limit(1).maybeSingle();
  if (conflict) {
    const inicioBR = new Date(conflict.inicio).toLocaleString("pt-BR", {
      timeZone: APP_TIMEZONE,
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    return { error: `${vm.nome} já tem captação "${conflict.titulo}" às ${inicioBR}` };
  }

  if (!params.ignorarBloqueio) {
    const warning = await checarBloqueioVideomaker(sb, {
      videomakerId: params.videomakerId,
      nome: vm.nome,
      dataLocal: params.dataLocal,
      horaInicioLocal: params.horaInicioLocal,
      horaFimLocal: params.horaFimLocal,
    });
    if (warning) return { blockWarning: warning };
  }

  return { ok: true, nome: vm.nome };
}

type ActionResult = { error?: string; blockWarning?: string } | undefined;

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
    client_id: fd(formData, "client_id"),
    localizacao_endereco: fd(formData, "localizacao_endereco"),
    localizacao_maps_url: fd(formData, "localizacao_maps_url"),
    link_roteiro: fd(formData, "link_roteiro"),
    roteiro_tipo: (fd(formData, "roteiro_tipo") as "link" | "pdf" | undefined) ?? null,
    roteiro_pdf_path: fd(formData, "roteiro_pdf_path"),
    observacoes_gravacao: fd(formData, "observacoes_gravacao"),
    videomaker_assigned_id: fd(formData, "videomaker_assigned_id"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const inicioUtc = brtInputToUtcIso(parsed.data.inicio);
  const fimUtc = brtInputToUtcIso(parsed.data.fim);

  // Wall-clock local (fuso da app) direto do input datetime-local, pra checagem
  // de bloqueio sem conversão de TZ. "2026-07-10T14:00" → data + HH:MM.
  const dataLocal = parsed.data.inicio.slice(0, 10);
  const horaInicioLocal = parsed.data.inicio.slice(11, 16);
  const horaFimLocal = parsed.data.fim.slice(11, 16);
  const ignorarBloqueio = fd(formData, "ignorar_bloqueio") === "true";

  if (new Date(fimUtc) <= new Date(inicioUtc)) {
    return { error: "Horário de fim deve ser posterior ao início" };
  }

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").limit(1).single();
  if (!org) return { error: "Organização não encontrada" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Gravação: quem pode delegar (coord audiovisual, sócio, adm) pode escolher o
  // videomaker direto na criação. Pro coord audiovisual é obrigatório; pros
  // demais é opcional. Quem não pode delegar (assessor etc.) sempre manda pra
  // fila (pending_delegation) — o campo é ignorado por segurança.
  const isVideomaker = parsed.data.sub_calendar === "videomakers";
  const podeDelegar = canRoleDelegateVideomaker(actor.role);
  const videomakerObrigatorio = isVideomakerObrigatorioParaRole(actor.role);

  let videomakerId: string | null = null;
  if (isVideomaker && podeDelegar) {
    videomakerId = parsed.data.videomaker_assigned_id ?? null;
    if (!videomakerId && videomakerObrigatorio) {
      return { error: "Escolha o videomaker responsável pela gravação" };
    }
    if (videomakerId) {
      const check = await validateVideomakerAssignment(sb, {
        videomakerId,
        inicioUtc,
        fimUtc,
        dataLocal,
        horaInicioLocal,
        horaFimLocal,
        ignorarBloqueio,
      });
      if ("error" in check) return { error: check.error };
      if ("blockWarning" in check) return { blockWarning: check.blockWarning };
    }
  }

  const participantesFinais = comParticipanteVideomaker(
    parsed.data.participantes_ids,
    videomakerId,
  );

  const basePayload = {
    organization_id: org.id,
    titulo: parsed.data.titulo,
    descricao: parsed.data.descricao || null,
    inicio: inicioUtc,
    fim: fimUtc,
    sub_calendar: parsed.data.sub_calendar,
    criado_por: actor.id,
    participantes_ids: participantesFinais,
    client_id: parsed.data.client_id || null,
    localizacao_endereco: parsed.data.localizacao_endereco?.trim() || null,
    localizacao_maps_url: parsed.data.localizacao_maps_url?.trim() || null,
    link_roteiro: parsed.data.link_roteiro?.trim() || null,
    roteiro_tipo: parsed.data.roteiro_tipo ?? null,
    roteiro_pdf_path: parsed.data.roteiro_pdf_path ?? null,
    observacoes_gravacao: parsed.data.observacoes_gravacao?.trim() || null,
  };
  // Com videomaker escolhido → nasce agendado (scheduled) direto pra ele.
  // Sem videomaker (ou quem não delega) → fila do coordenador (pending_delegation).
  const insertPayload = !isVideomaker
    ? basePayload
    : videomakerId
      ? {
          ...basePayload,
          videomaker_assigned_id: videomakerId,
          videomaker_status: "scheduled" as const,
          videomaker_delegado_por: actor.id,
          videomaker_delegado_em: new Date().toISOString(),
        }
      : { ...basePayload, videomaker_status: "pending_delegation" as const };

  let createResult = await sb
    .from("calendar_events")
    .insert(insertPayload)
    .select("id")
    .single();

  if (createResult.error) {
    const msg = String(createResult.error.message ?? "");
    // Defesa em profundidade contra corrida (constraint no_videomaker_overlap).
    if (msg.includes("no_videomaker_overlap")) {
      return { error: "Esse videomaker já tem outra captação nesse horário. Recarregue e tente de novo." };
    }
    // Fallback: se a migration de videomaker_status ainda não foi aplicada,
    // insere sem os campos de delegação (modo legado, visível direto na agenda).
    if (isVideomaker && (msg.includes("videomaker_status") || msg.includes("videomaker_assigned_id") || msg.includes("schema cache"))) {
      console.warn("[calendario] migration videomaker_* não aplicada - fallback sem delegação");
      createResult = await sb
        .from("calendar_events")
        .insert(basePayload)
        .select("id")
        .single();
    }
  }

  const { data: created, error } = createResult;
  if (error || !created) return { error: error?.message ?? "Falha ao criar evento" };

  await logAudit({
    entidade: "calendar_events",
    entidade_id: created.id,
    acao: "create",
    dados_depois: insertPayload as unknown as Record<string, unknown>,
    ator_id: actor.id,
  });

  // Notifica os participantes do evento novo (exceto o próprio criador).
  // Quando há videomaker designado, ele entra em participantesFinais e recebe
  // a notificação padrão de participante.
  after(notifyCalendarParticipants({
    eventId: created.id,
    titulo: parsed.data.titulo,
    inicio: inicioUtc,
    participantesNovos: participantesFinais,
    actorId: actor.id,
    actorNome: actor.nome,
  }));

  revalidatePath("/calendario");
  revalidateTag("calendar", "default");
  revalidateTag("dashboard", "default");
  if (isVideomaker) {
    revalidatePath("/audiovisual");
    // Com videomaker já designado, a captação nasce agendada → vai pra agenda.
    // Sem videomaker, cai na fila "Captações futuras" pro coordenador delegar.
    if (!videomakerId) {
      redirect(`/audiovisual?tab=aguardando_videomaker&novo=${created.id}`);
    }
  }
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
    client_id: fd(formData, "client_id"),
    localizacao_endereco: fd(formData, "localizacao_endereco"),
    localizacao_maps_url: fd(formData, "localizacao_maps_url"),
    link_roteiro: fd(formData, "link_roteiro"),
    roteiro_tipo: (fd(formData, "roteiro_tipo") as "link" | "pdf" | undefined) ?? null,
    roteiro_pdf_path: fd(formData, "roteiro_pdf_path"),
    observacoes_gravacao: fd(formData, "observacoes_gravacao"),
    videomaker_assigned_id: fd(formData, "videomaker_assigned_id"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const inicioUtc = brtInputToUtcIso(parsed.data.inicio);
  const fimUtc = brtInputToUtcIso(parsed.data.fim);

  // Wall-clock local (fuso da app) direto do input datetime-local, pra checagem
  // de bloqueio sem conversão de TZ. "2026-07-10T14:00" → data + HH:MM.
  const dataLocal = parsed.data.inicio.slice(0, 10);
  const horaInicioLocal = parsed.data.inicio.slice(11, 16);
  const horaFimLocal = parsed.data.fim.slice(11, 16);
  const ignorarBloqueio = fd(formData, "ignorar_bloqueio") === "true";

  if (new Date(fimUtc) <= new Date(inicioUtc)) {
    return { error: "Horário de fim deve ser posterior ao início" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbUpd = supabase as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const beforeVm = before as any;
  const isVideomaker = parsed.data.sub_calendar === "videomakers";
  const podeDelegar = canRoleDelegateVideomaker(actor.role);
  const videomakerObrigatorio = isVideomakerObrigatorioParaRole(actor.role);
  const vmAntes: string | null = beforeVm?.videomaker_assigned_id ?? null;
  const participantesAntesBd: string[] = beforeVm?.participantes_ids ?? [];

  // Na gravação a seção "Participantes" não aparece no form, então o form manda
  // a lista vazia. Preservamos os participantes que já existiam no banco em vez
  // de sobrescrever; o videomaker designado é sincronizado abaixo.
  let participantesFinais = isVideomaker
    ? participantesAntesBd
    : parsed.data.participantes_ids;

  // Campos de delegação a aplicar (só pra quem pode delegar mexe neles).
  const videomakerUpdate: Record<string, unknown> = {};
  if (isVideomaker && podeDelegar) {
    const videomakerId = parsed.data.videomaker_assigned_id ?? null;
    if (!videomakerId && videomakerObrigatorio) {
      return { error: "Escolha o videomaker responsável pela gravação" };
    }
    if (videomakerId) {
      if (videomakerId !== vmAntes) {
        const check = await validateVideomakerAssignment(sbUpd, {
          videomakerId,
          inicioUtc,
          fimUtc,
          excludeEventId: id,
          dataLocal,
          horaInicioLocal,
          horaFimLocal,
          ignorarBloqueio,
        });
        if ("error" in check) return { error: check.error };
        if ("blockWarning" in check) return { blockWarning: check.blockWarning };
        // Troca: remove o videomaker antigo (se estava só pela atribuição) e
        // adiciona o novo.
        participantesFinais = comParticipanteVideomaker(
          participantesFinais.filter((pid) => pid !== vmAntes),
          videomakerId,
        );
      } else {
        participantesFinais = comParticipanteVideomaker(participantesFinais, videomakerId);
      }
      videomakerUpdate.videomaker_assigned_id = videomakerId;
      videomakerUpdate.videomaker_status = "scheduled";
      videomakerUpdate.videomaker_delegado_por = actor.id;
      videomakerUpdate.videomaker_delegado_em = new Date().toISOString();
    } else {
      // Sócio/adm deixou em branco → volta pra fila do coordenador.
      participantesFinais = participantesFinais.filter((pid) => pid !== vmAntes);
      videomakerUpdate.videomaker_assigned_id = null;
      videomakerUpdate.videomaker_status = "pending_delegation";
      videomakerUpdate.videomaker_delegado_por = null;
      videomakerUpdate.videomaker_delegado_em = null;
    }
  }

  const updatePayload = {
    titulo: parsed.data.titulo,
    descricao: parsed.data.descricao || null,
    inicio: inicioUtc,
    fim: fimUtc,
    sub_calendar: parsed.data.sub_calendar,
    participantes_ids: participantesFinais,
    client_id: parsed.data.client_id || null,
    localizacao_endereco: parsed.data.localizacao_endereco?.trim() || null,
    localizacao_maps_url: parsed.data.localizacao_maps_url?.trim() || null,
    link_roteiro: parsed.data.link_roteiro?.trim() || null,
    roteiro_tipo: parsed.data.roteiro_tipo ?? null,
    roteiro_pdf_path: parsed.data.roteiro_pdf_path ?? null,
    observacoes_gravacao: parsed.data.observacoes_gravacao?.trim() || null,
    ...videomakerUpdate,
  };

  // Se o PDF do roteiro foi trocado/removido, apaga o arquivo antigo do storage.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const beforeAny = before as any;
  const pdfAntigo: string | null = beforeAny?.roteiro_pdf_path ?? null;
  const trocouTipo = before && beforeAny.roteiro_tipo !== parsed.data.roteiro_tipo;
  const trocouPdf = before && beforeAny.roteiro_pdf_path !== parsed.data.roteiro_pdf_path;
  if (pdfAntigo && (trocouTipo || trocouPdf)) {
    const { deleteRoteiroPdf } = await import("@/lib/briefing-gravacao/storage");
    after(deleteRoteiroPdf(pdfAntigo));
  }

  // Se o início mudou, zera o reminder pra re-disparar o cron de 30-min antes
  // pro novo horário. Sem isso, eventos remarcados pra mais tarde não recebem
  // aviso pro novo timestamp.
  if (before && new Date((before as unknown as { inicio: string }).inicio).getTime() !== new Date(inicioUtc).getTime()) {
    (updatePayload as { reminded_30min_at?: string | null }).reminded_30min_at = null;
  }

  // .select() + check de linhas afetadas: a RLS pode negar o UPDATE
  // silenciosamente (error:null, 0 rows). Sem isso, reportaríamos sucesso falso.
  const { data: updatedRows, error } = await sbUpd
    .from("calendar_events")
    .update(updatePayload)
    .eq("id", id)
    .select("id");
  if (error) {
    const msg = String(error.message ?? "");
    if (msg.includes("no_videomaker_overlap")) {
      return { error: "Esse videomaker já tem outra captação nesse horário. Recarregue e tente de novo." };
    }
    return { error: error.message };
  }
  if (!updatedRows || updatedRows.length === 0) {
    return { error: "Você não tem permissão para editar este evento." };
  }

  await logAudit({
    entidade: "calendar_events",
    entidade_id: id,
    acao: "update",
    dados_antes: before as unknown as Record<string, unknown>,
    dados_depois: updatePayload as unknown as Record<string, unknown>,
    ator_id: actor.id,
  });

  // Notifica APENAS os participantes que foram adicionados nesta edição
  // (não re-notifica quem já estava). Usa a lista final (que pode incluir o
  // videomaker recém-designado) comparada com a que estava no banco.
  const adicionados = participantesFinais.filter(
    (pid) => !participantesAntesBd.includes(pid),
  );
  if (adicionados.length > 0) {
    after(notifyCalendarParticipants({
      eventId: id,
      titulo: parsed.data.titulo,
      inicio: inicioUtc,
      participantesNovos: adicionados,
      actorId: actor.id,
      actorNome: actor.nome,
    }));
  }

  revalidatePath("/calendario");
  revalidatePath(`/calendario/${id}`);
  revalidateTag("calendar", "default");
  revalidateTag("dashboard", "default");
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
  revalidateTag("calendar", "default");
  revalidateTag("dashboard", "default");
  return { success: "Evento removido" };
}
