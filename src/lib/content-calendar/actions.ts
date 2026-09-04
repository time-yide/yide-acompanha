"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
import { regenerateSinglePost } from "./generator";
import type { GeneratedPost, ContentCalendarRow } from "./types";
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
export async function approveCalendarAction(
  calendarId: string,
): Promise<ActionResult> {
  const user = await requireAuth();

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
    .select("nome, organization_id, assessor_id")
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

  // 3. Criar tarefa de revisão/produção do cronograma
  const hasVideos = posts.some((p) => p.tipo === "video");
  const { data: task } = await sbAny
    .from("tasks")
    .insert({
      titulo: `Cronograma ${calendar.mes_referencia} — ${client.nome}`,
      descricao: `Cronograma de conteúdo aprovado para ${calendar.mes_referencia}. ${posts.length} posts planejados${hasVideos ? ` (${posts.filter((p) => p.tipo === "video").length} vídeos)` : ""}.`,
      prioridade: "media",
      tipo: "geral",
      atribuido_a: client.assessor_id ?? user.id,
      client_id: calendar.client_id,
      due_date: `${calendar.mes_referencia}-01`,
      criado_por: user.id,
      participantes_ids: [],
      links: [],
      attachment_urls: [],
    })
    .select("id")
    .single();

  if (task) {
    // Vincular tarefa ao cronograma
    await sbAny
      .from("content_calendars")
      .update({ task_id: task.id })
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

  // 5. Notificar
  if (client.assessor_id && client.assessor_id !== user.id) {
    await dispatchNotification({
      evento_tipo: "task_assigned",
      titulo: "Cronograma aprovado",
      mensagem: `${user.nome} aprovou o cronograma de ${calendar.mes_referencia} para "${client.nome}".`,
      link: `/content-calendar/${calendar.client_id}?mes=${calendar.mes_referencia}`,
      user_ids_extras: [client.assessor_id],
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
): Promise<ActionResult & { post?: GeneratedPost }> {
  await requireAuth();

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
export async function enqueueCalendarAction(
  clientId: string,
  mesReferencia: string,
): Promise<ActionResult> {
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

  const { error } = await sbAny
    .from("content_calendars")
    .insert({
      organization_id: client.organization_id,
      client_id: clientId,
      mes_referencia: mesReferencia,
      modo,
      status: "pendente_geracao",
      criado_por: user.id,
    });

  if (error) return { error: error.message };

  revalidatePath("/social-media");
  return { success: true };
}
