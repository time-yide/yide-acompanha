"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
import { dispatchChatNotification } from "@/lib/notificacoes/dispatch-chat";
import { canAccessChannel, canAccessMemberChannel, channelLink, isMemberBasedKind, type Channel, type ChannelKind } from "./types";
import { ESCRITORIO_UNREAD_TAG } from "./queries";

type ActionResult = { error?: string; success?: boolean; id?: string; created_at?: string };

const sendMessageSchema = z.object({
  /** Id gerado no client pra alinhar a msg otimista com o insert e o evento
   * realtime — assim a dedup por id funciona e não duplica no envio. */
  id: z.string().uuid().optional(),
  channel_id: z.string().uuid(),
  // Pode ser vazio SE tiver anexo (mensagem só de imagem/áudio/arquivo).
  conteudo: z.string().trim().max(4000, "Mensagem muito longa").default(""),
  reply_to_id: z.string().uuid().nullable().optional(),
  attachment_urls: z.array(z.string().url()).max(5, "Máx. 5 anexos").default([]),
  mentioned_user_ids: z.array(z.string().uuid()).max(20).default([]),
}).refine((d) => d.conteudo.length > 0 || d.attachment_urls.length > 0, {
  message: "Escreva algo ou anexe um arquivo",
  path: ["conteudo"],
});

/** Preview textual pra notificação quando a mensagem é só anexo (sem texto). */
function attachmentPreview(urls: string[]): string {
  if (urls.length === 0) return "";
  const isAudio = (u: string) => /\.(webm|m4a|mp3|mpeg|ogg|wav|aac)(\?|$)/i.test(u);
  const isImg = (u: string) => /\.(jpe?g|png|webp|gif)(\?|$)/i.test(u);
  if (urls.some(isAudio)) return "🎤 Mensagem de voz";
  if (urls.every(isImg)) return urls.length > 1 ? `🖼️ ${urls.length} imagens` : "🖼️ Imagem";
  return urls.length > 1 ? `📎 ${urls.length} anexos` : "📎 Anexo";
}

function fdString(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  if (v === null || v === "") return undefined;
  return String(v);
}

function fdJsonArray<T = unknown>(formData: FormData, key: string): T[] {
  const raw = formData.get(key);
  if (typeof raw !== "string" || !raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function sendChatMessageAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireAuth();

  const parsed = sendMessageSchema.safeParse({
    id: fdString(formData, "id"),
    channel_id: fdString(formData, "channel_id"),
    conteudo: fdString(formData, "conteudo"),
    reply_to_id: fdString(formData, "reply_to_id"),
    attachment_urls: fdJsonArray<string>(formData, "attachment_urls"),
    mentioned_user_ids: fdJsonArray<string>(formData, "mentioned_user_ids"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Confirma membership antes de inserir (RLS já cobre, mas dá feedback melhor)
  const { data: channel } = await sb
    .from("chat_channels")
    .select("id, kind, nome, member_ids")
    .eq("id", parsed.data.channel_id)
    .maybeSingle();
  if (!channel) return { error: "Canal não encontrado" };

  // Permissão diverge por tipo de canal:
  // - Canais fixos (por cargo): role-based via canAccessChannel
  // - DMs e grupos: user precisa estar em member_ids
  const channelTyped = channel as Channel;
  const allowed = isMemberBasedKind(channelTyped.kind)
    ? canAccessMemberChannel(channelTyped, actor.id)
    : canAccessChannel(actor.role, channelTyped.kind as ChannelKind);
  if (!allowed) {
    return { error: "Você não tem acesso a esse canal" };
  }

  const { data: created, error } = await sb
    .from("chat_messages")
    .insert({
      ...(parsed.data.id ? { id: parsed.data.id } : {}),
      channel_id: parsed.data.channel_id,
      autor_id: actor.id,
      conteudo: parsed.data.conteudo,
      reply_to_id: parsed.data.reply_to_id || null,
      attachment_urls: parsed.data.attachment_urls,
      mentioned_user_ids: parsed.data.mentioned_user_ids,
    })
    .select("id, created_at")
    .single();
  if (error || !created) return { error: error?.message ?? "Falha ao enviar mensagem" };

  // Texto pras notificações: se a mensagem é só anexo (sem texto), usa um
  // resumo tipo "🎤 Mensagem de voz" / "📎 Anexo" em vez de vazio.
  const notifText = parsed.data.conteudo || attachmentPreview(parsed.data.attachment_urls);

  // Notificações SAEM do caminho crítico. Antes tudo era awaited antes do
  // return: buscar todos os profiles do canal + inserir notifs in-app + mandar
  // web push pra CADA destinatário. No canal Geral (todo mundo) isso segurava
  // a resposta por segundos → no mobile a msg demorava a confirmar ("enviando").
  // Com after(), a action responde logo após o insert e o fan-out roda depois
  // da resposta. Notificação é best-effort; um leve atraso nela é aceitável.
  after(async () => {
    try {
      await dispatchChatNotification({
        messageId: created.id,
        channelId: parsed.data.channel_id,
        authorId: actor.id,
        authorName: actor.nome,
        authorAvatarUrl: actor.avatarUrl,
        channelKind: channel.kind as ChannelKind,
        channelName: channel.nome,
        conteudo: notifText,
        mentionedUserIds: parsed.data.mentioned_user_ids.filter((id) => id !== actor.id),
        memberIds: channel.member_ids ?? undefined,
      });
    } catch (e) {
      console.error("[sendChatMessageAction] notification dispatch failed:", e);
    }

    // Reply: notifica autor da mensagem original (se for outro)
    if (parsed.data.reply_to_id) {
      try {
        const { data: original } = await sb
          .from("chat_messages")
          .select("autor_id")
          .eq("id", parsed.data.reply_to_id)
          .maybeSingle();
        if (original && original.autor_id && original.autor_id !== actor.id) {
          const preview = notifText.slice(0, 80) + (notifText.length > 80 ? "…" : "");
          await dispatchNotification({
            evento_tipo: "task_assigned",
            titulo: `Resposta em ${channel.nome}`,
            mensagem: `${actor.nome} respondeu: ${preview}`,
            link: channelLink(channel.kind as ChannelKind, parsed.data.channel_id),
            user_ids_extras: [original.autor_id],
            source_user_id: actor.id,
          });
        }
      } catch (e) {
        console.error("[sendChatMessageAction] reply notification failed:", e);
      }
    }
  });

  // Não revalida o path do canal: o cliente já adicionou a mensagem otimista
  // e o realtime cobre outros usuários. Revalidar aqui só causa refetch
  // desnecessário e pode atrapalhar o estado local.
  revalidateTag(ESCRITORIO_UNREAD_TAG, "default");
  return { success: true, id: created.id, created_at: created.created_at };
}

const markReadSchema = z.object({
  channel_id: z.string().uuid(),
});

export async function markChannelReadAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  const parsed = markReadSchema.safeParse({
    channel_id: fdString(formData, "channel_id"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { error } = await sb.from("chat_reads").upsert(
    {
      user_id: actor.id,
      channel_id: parsed.data.channel_id,
      last_read_at: new Date().toISOString(),
    },
    { onConflict: "user_id,channel_id" },
  );
  if (error) return { error: error.message };
  revalidatePath("/escritorio");
  revalidateTag(ESCRITORIO_UNREAD_TAG, "default");
  return { success: true };
}

const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024; // 15 MB
const ALLOWED_ATTACHMENT_TYPES = [
  // Imagens
  "image/jpeg", "image/png", "image/webp", "image/gif",
  // PDF
  "application/pdf",
  // Áudio (gravação de voz no navegador + upload)
  "audio/webm", "audio/mp4", "audio/mpeg", "audio/mp3", "audio/ogg", "audio/wav", "audio/aac", "audio/x-m4a",
  // Documentos comuns do dia-a-dia
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain", "text/csv", "application/zip",
];

/**
 * Prepara um upload de anexo direto do browser pro Storage.
 *
 * IMPORTANTE: o arquivo NÃO passa por Server Action. Server Actions têm teto de
 * corpo (bodySizeLimit = 2MB neste projeto) — foto de celular (3-8MB) estourava
 * e falhava o envio. Aqui só geramos um signed upload token (payload minúsculo);
 * o browser envia os bytes direto pro Storage via `uploadToSignedUrl`. Mesmo
 * padrão do social-media/editor-ia. Como o bucket é público e o path é
 * determinístico, já devolvemos a URL pública final.
 */
export async function prepareChatAttachmentUpload(
  fileName: string,
  fileType: string,
  fileSize: number,
): Promise<{ error: string } | { path: string; token: string; url: string }> {
  await requireAuth();

  // MediaRecorder manda mime com parâmetros (ex: "audio/webm;codecs=opus").
  // Normaliza pro tipo base antes de validar.
  const baseType = fileType.split(";")[0].trim().toLowerCase();
  if (!ALLOWED_ATTACHMENT_TYPES.includes(baseType)) {
    return { error: "Tipo de arquivo não suportado" };
  }
  if (fileSize <= 0) return { error: "Arquivo vazio" };
  if (fileSize > MAX_ATTACHMENT_BYTES) return { error: "Máximo 15MB por arquivo" };

  const ext = (fileName.split(".").pop() || "bin").toLowerCase();
  const path = `chat/${crypto.randomUUID()}.${ext}`;

  const admin = createServiceRoleClient();
  const { data, error } = await admin.storage.from("chat-attachments").createSignedUploadUrl(path);
  if (error || !data?.token) {
    return { error: error?.message ?? "Erro ao preparar upload" };
  }

  const { data: pub } = admin.storage.from("chat-attachments").getPublicUrl(data.path ?? path);
  return { path: data.path ?? path, token: data.token, url: pub.publicUrl };
}
