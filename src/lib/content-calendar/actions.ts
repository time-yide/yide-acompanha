"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
import { regenerateSinglePost } from "./generator";
import { generateDesignForTask } from "@/lib/canva/auto-design";
import type { GeneratedPost, ContentCalendarRow, CalendarBriefing } from "./types";
import {
  PACOTES_COM_CRONOGRAMA,
  PACOTES_CRONOGRAMA_COMPLETO,
} from "./types";
import type { CalendarMode } from "./types";

interface ActionOk {
  success: true;
}
interface ActionErr {
  error: string;
}
type ActionResult = ActionOk | ActionErr;

/**
 * Aprova o cronograma: marca como aprovado, cria posts no social_media_posts
 * (modo completo), cria 1 tarefa, e tenta criar alerta de gravação.
 */
const ROLES_PODEM_APROVAR = ["assessor", "socio", "adm"];

export async function approveCalendarAction(
  calendarId: string,
): Promise<ActionResult> {
  const user = await requireAuth();

  if (!ROLES_PODEM_APROVAR.includes(user.role)) {
    return { error: "Apenas assessor, sócio ou adm pode aprovar cronogramas" };
  }

  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;

  // Carregar cronograma
  const { data: cal, error: calErr } = await sbAny
    .from("content_calendars")
    .select("*")
    .eq("id", calendarId)
    .single();

  if (calErr || !cal) {
    return { error: "Cronograma não encontrado" };
  }

  const calendar = cal as ContentCalendarRow;

  if (calendar.status !== "gerado") {
    return { error: "Cronograma precisa estar no status 'gerado' para aprovar" };
  }

  const posts = calendar.posts_json as GeneratedPost[];

  // Carregar dados do cliente
  const { data: client } = await sbAny
    .from("clients")
    .select("nome, organization_id, assessor_id, designer_id, videomaker_id, editor_id, coordenador_id")
    .eq("id", calendar.client_id)
    .single();

  if (!client) {
    return { error: "Cliente não encontrado" };
  }

  // 1. Marcar como aprovado
  await sbAny
    .from("content_calendars")
    .update({
      status: "aprovado",
      aprovado_por: user.id,
      aprovado_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", calendarId);

  // 2. Criar posts no social_media_posts (modo completo apenas)
  if (calendar.modo === "completo") {
    for (const post of posts) {
      if (post.estrategia_mes) continue; // pula item de estratégia

      const formato =
        post.tipo === "video"
          ? "reels"
          : post.tipo === "carrossel"
            ? "carrossel"
            : "feed";

      await sbAny.from("social_media_posts").insert({
        organization_id: client.organization_id,
        client_id: calendar.client_id,
        titulo: post.tema,
        legenda: post.legenda ?? null,
        hashtags: (post.hashtags ?? []).join(" "),
        primeiro_comentario: post.primeiro_comentario ?? null,
        formato,
        redes: ["instagram"],
        agendar_para: post.data_sugerida
          ? `${post.data_sugerida}T12:00:00-03:00`
          : null,
        status: "rascunho",
        criado_por: user.id,
      });
    }
  }

  // 3. Criar tarefas individuais por post (arte separada de vídeo)
  const taskIds: string[] = [];
  const hasVideos = posts.some((p) => p.tipo === "video");

  for (const post of posts) {
    if (post.estrategia_mes) continue;

    const isVideo = post.tipo === "video";

    const atribuidoA = isVideo
      ? (client.editor_id ?? client.videomaker_id ?? client.coordenador_id ?? client.assessor_id ?? user.id)
      : (client.designer_id ?? client.coordenador_id ?? client.assessor_id ?? user.id);

    const taskTipo = isVideo ? "video" : "arte";

    const descricao = isVideo
      ? [
          `Tema: ${post.tema}`,
          post.roteiro ? `\nRoteiro:\n${post.roteiro}` : "",
          post.material_estudo ? `\nMaterial de estudo:\n${post.material_estudo}` : "",
        ].filter(Boolean).join("\n")
      : [
          `Tema: ${post.tema}`,
          post.legenda ? `\nLegenda:\n${post.legenda}` : "",
          post.hashtags?.length ? `\nHashtags: ${post.hashtags.join(" ")}` : "",
          post.primeiro_comentario ? `\n1º comentário: ${post.primeiro_comentario}` : "",
        ].filter(Boolean).join("\n");

    const participantes = [];
    if (client.assessor_id && client.assessor_id !== atribuidoA) {
      participantes.push(client.assessor_id);
    }

    const { data: taskRow } = await sbAny
      .from("tasks")
      .insert({
        titulo: `${post.tema} — ${client.nome}`,
        descricao: descricao.trim(),
        prioridade: "media",
        tipo: taskTipo,
        formatos: ["feed"],
        atribuido_a: atribuidoA,
        client_id: calendar.client_id,
        due_date: post.data_sugerida || `${calendar.mes_referencia}-01`,
        criado_por: user.id,
        status_aprovacao: "pendente_envio",
        participantes_ids: participantes,
        links: [],
        attachment_urls: [],
      })
      .select("id")
      .single();

    if (taskRow) {
      taskIds.push(taskRow.id);
      if (!isVideo) {
        generateDesignForTask({
          taskId: taskRow.id,
          clientId: calendar.client_id,
          organizationId: client.organization_id,
          titulo: post.tema,
          descricao: descricao.trim(),
        }).catch((err) =>
          console.warn("[content-calendar] auto-design failed for task", taskRow.id, err),
        );
      }
    }
  }

  if (taskIds.length > 0) {
    await sbAny
      .from("content_calendars")
      .update({ task_id: taskIds[0] })
      .eq("id", calendarId);
  }

  // 4. Criar alerta de agendamento de gravação (se existem vídeos)
  if (hasVideos) {
    try {
      await sbAny.from("recording_scheduling_alerts").insert({
        organization_id: client.organization_id,
        client_id: calendar.client_id,
        mes_referencia: calendar.mes_referencia,
        qtd_videos: posts.filter((p) => p.tipo === "video").length,
        criado_por: user.id,
      });
    } catch {
      // Tabela pode não existir ainda — ignora silenciosamente
      console.warn(
        "[content-calendar] recording_scheduling_alerts insert falhou (tabela pode não existir)",
      );
    }
  }

  // 5. Notificar equipe
  const artCount = posts.filter((p) => !p.estrategia_mes && (p.tipo === "imagem" || p.tipo === "carrossel")).length;
  const vidCount = posts.filter((p) => !p.estrategia_mes && p.tipo === "video").length;
  const resumo = [
    artCount > 0 ? `${artCount} arte${artCount > 1 ? "s" : ""}` : "",
    vidCount > 0 ? `${vidCount} vídeo${vidCount > 1 ? "s" : ""}` : "",
  ].filter(Boolean).join(" e ");

  const notifyIds = new Set<string>();
  if (client.assessor_id && client.assessor_id !== user.id) notifyIds.add(client.assessor_id);
  if (client.designer_id && client.designer_id !== user.id) notifyIds.add(client.designer_id);
  if (client.editor_id && client.editor_id !== user.id) notifyIds.add(client.editor_id);
  if (client.videomaker_id && client.videomaker_id !== user.id) notifyIds.add(client.videomaker_id);

  if (notifyIds.size > 0) {
    await dispatchNotification({
      evento_tipo: "task_assigned",
      titulo: "Cronograma aprovado",
      mensagem: `${user.nome} aprovou o cronograma de ${calendar.mes_referencia} para "${client.nome}". ${taskIds.length} tarefas criadas (${resumo}).`,
      link: `/content-calendar/${calendar.client_id}?mes=${calendar.mes_referencia}`,
      user_ids_extras: [...notifyIds],
      source_user_id: user.id,
    });
  }

  revalidatePath("/content-calendar");
  revalidatePath("/social-media");
  return { success: true };
}

/**
 * Atualiza os posts do cronograma (edição manual).
 */
export async function updateCalendarPostsAction(
  calendarId: string,
  posts: GeneratedPost[],
): Promise<ActionResult> {
  await requireAuth();

  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;

  const { data: cal } = await sbAny
    .from("content_calendars")
    .select("id, status")
    .eq("id", calendarId)
    .single();

  if (!cal) {
    return { error: "Cronograma não encontrado" };
  }

  if ((cal as ContentCalendarRow).status === "aprovado") {
    return { error: "Cronograma já aprovado — não pode ser editado" };
  }

  const { error } = await sbAny
    .from("content_calendars")
    .update({
      posts_json: posts,
      updated_at: new Date().toISOString(),
    })
    .eq("id", calendarId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/content-calendar");
  return { success: true };
}

export async function regeneratePostAction(
  calendarId: string,
  postIndex: number,
  instrucoes?: string,
): Promise<ActionResult & { post?: GeneratedPost }> {
  await requireAuth();

  const safeInstrucoes = instrucoes?.slice(0, 500);

  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;

  const { data: cal } = await sbAny
    .from("content_calendars")
    .select("*")
    .eq("id", calendarId)
    .single();

  if (!cal) {
    return { error: "Cronograma não encontrado" };
  }

  const calendar = cal as ContentCalendarRow;

  if (calendar.status === "aprovado") {
    return { error: "Cronograma já aprovado — não pode regenerar posts" };
  }

  const currentPosts = calendar.posts_json;
  if (postIndex < 0 || postIndex >= currentPosts.length) {
    return { error: "Índice de post inválido" };
  }

  try {
    const newPost = await regenerateSinglePost(
      calendarId,
      postIndex,
      currentPosts,
      calendar.client_id,
      calendar.mes_referencia,
      calendar.modo,
      safeInstrucoes,
    );

    // Atualizar o post no array
    const updatedPosts = [...currentPosts];
    updatedPosts[postIndex] = newPost;

    await sbAny
      .from("content_calendars")
      .update({
        posts_json: updatedPosts,
        updated_at: new Date().toISOString(),
      })
      .eq("id", calendarId);

    revalidatePath("/content-calendar");
    return { success: true, post: newPost };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: `Falha ao regenerar post: ${msg}` };
  }
}

/**
 * Enfileira cronograma de um cliente para um mês específico.
 * Útil quando o cron mensal já passou e se quer gerar agora.
 */
export async function saveBriefingAction(
  calendarId: string,
  briefing: CalendarBriefing,
): Promise<ActionResult> {
  await requireAuth();

  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;

  const { data: cal } = await sbAny
    .from("content_calendars")
    .select("id, status")
    .eq("id", calendarId)
    .single();

  if (!cal) return { error: "Cronograma não encontrado" };
  if ((cal as ContentCalendarRow).status === "aprovado") {
    return { error: "Cronograma já aprovado — não pode editar briefing" };
  }

  const { error } = await sbAny
    .from("content_calendars")
    .update({
      briefing_assessor: briefing,
      updated_at: new Date().toISOString(),
    })
    .eq("id", calendarId);

  if (error) return { error: error.message };

  revalidatePath("/social-media");
  return { success: true };
}

export async function enqueueCalendarAction(
  clientId: string,
  mesReferencia: string,
  briefing?: CalendarBriefing,
): Promise<ActionResult & { calendarId?: string }> {
  const user = await requireAuth();
  if (!["adm", "socio", "coordenador", "assessor"].includes(user.role)) {
    return { error: "Sem permissão" };
  }

  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;

  const { data: client } = await sbAny
    .from("clients")
    .select("id, organization_id, tipo_pacote, nicho_id")
    .eq("id", clientId)
    .single();

  if (!client) return { error: "Cliente não encontrado" };
  if (!client.nicho_id) return { error: "Cliente sem nicho configurado. Vá em Configurações → Nichos e associe um nicho a este cliente." };
  if (!(PACOTES_COM_CRONOGRAMA as readonly string[]).includes(client.tipo_pacote)) {
    return { error: "Pacote do cliente não inclui cronograma de conteúdo" };
  }

  const { data: existing } = await sbAny
    .from("content_calendars")
    .select("id")
    .eq("client_id", clientId)
    .eq("mes_referencia", mesReferencia)
    .maybeSingle();

  if (existing) return { error: "Já existe cronograma para este mês" };

  const modo: CalendarMode = (
    PACOTES_CRONOGRAMA_COMPLETO as readonly string[]
  ).includes(client.tipo_pacote)
    ? "completo"
    : "leve";

  const { data: inserted, error } = await sbAny
    .from("content_calendars")
    .insert({
      organization_id: client.organization_id,
      client_id: clientId,
      mes_referencia: mesReferencia,
      modo,
      status: "pendente_geracao",
      criado_por: user.id,
      ...(briefing ? { briefing_assessor: briefing } : {}),
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/social-media");
  return { success: true, calendarId: inserted?.id };
}

export async function retryCalendarAction(
  calendarId: string,
  briefing?: CalendarBriefing,
): Promise<ActionResult> {
  await requireAuth();

  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;

  const { data: cal } = await sbAny
    .from("content_calendars")
    .select("id, status")
    .eq("id", calendarId)
    .single();

  if (!cal) return { error: "Cronograma não encontrado" };

  const status = (cal as ContentCalendarRow).status;
  if (status !== "erro" && status !== "gerando") {
    return { error: "Só é possível reprocessar cronogramas com erro ou travados" };
  }

  const { error } = await sbAny
    .from("content_calendars")
    .update({
      status: "pendente_geracao",
      tentativas: 0,
      erro_msg: null,
      updated_at: new Date().toISOString(),
      ...(briefing ? { briefing_assessor: briefing } : {}),
    })
    .eq("id", calendarId);

  if (error) return { error: error.message };

  revalidatePath("/content-calendar");
  revalidatePath("/social-media");
  return { success: true };
}

/**
 * Enfileira cronogramas de TODOS os clientes elegíveis para um mês.
 * Mesma lógica do cron content-calendar-enqueue, mas disparável pela UI.
 */
export async function enqueueAllCalendarsAction(
  mesReferencia: string,
): Promise<{ created: number; skipped: number; total: number } | ActionErr> {
  const user = await requireAuth();
  if (!["adm", "socio"].includes(user.role)) {
    return { error: "Apenas sócio ou adm pode gerar cronogramas em lote" };
  }

  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;

  const { data: clients, error: fetchErr } = await sbAny
    .from("clients")
    .select("id, organization_id, tipo_pacote, nicho_id")
    .eq("status", "ativo")
    .not("nicho_id", "is", null)
    .in("tipo_pacote", [...PACOTES_COM_CRONOGRAMA]);

  if (fetchErr) return { error: fetchErr.message };

  const eligible = (clients ?? []) as Array<{
    id: string;
    organization_id: string;
    tipo_pacote: string;
    nicho_id: string;
  }>;

  let created = 0;
  let skipped = 0;

  for (const c of eligible) {
    const { data: existing } = await sbAny
      .from("content_calendars")
      .select("id")
      .eq("client_id", c.id)
      .eq("mes_referencia", mesReferencia)
      .maybeSingle();

    if (existing) {
      skipped++;
      continue;
    }

    const modo: CalendarMode = (
      PACOTES_CRONOGRAMA_COMPLETO as readonly string[]
    ).includes(c.tipo_pacote)
      ? "completo"
      : "leve";

    const { error: insertErr } = await sbAny
      .from("content_calendars")
      .insert({
        organization_id: c.organization_id,
        client_id: c.id,
        mes_referencia: mesReferencia,
        modo,
        status: "pendente_geracao",
        criado_por: user.id,
      });

    if (insertErr) {
      skipped++;
    } else {
      created++;
    }
  }

  revalidatePath("/social-media/cronograma-ia");
  return { created, skipped, total: eligible.length };
}
