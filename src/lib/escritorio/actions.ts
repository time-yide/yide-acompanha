"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
import { canAccessChannel, type ChannelKind } from "./types";

type ActionResult = { error?: string; success?: boolean };

const sendMessageSchema = z.object({
  channel_id: z.string().uuid(),
  conteudo: z.string().trim().min(1, "Mensagem vazia").max(4000, "Mensagem muito longa"),
  reply_to_id: z.string().uuid().nullable().optional(),
  attachment_urls: z.array(z.string().url()).max(5, "Máx. 5 anexos").default([]),
  mentioned_user_ids: z.array(z.string().uuid()).max(20).default([]),
});

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
    .select("id, kind, nome")
    .eq("id", parsed.data.channel_id)
    .maybeSingle();
  if (!channel) return { error: "Canal não encontrado" };

  if (!canAccessChannel(actor.role, channel.kind as ChannelKind)) {
    return { error: "Você não tem acesso a esse canal" };
  }

  const { data: created, error } = await sb
    .from("chat_messages")
    .insert({
      channel_id: parsed.data.channel_id,
      autor_id: actor.id,
      conteudo: parsed.data.conteudo,
      reply_to_id: parsed.data.reply_to_id || null,
      attachment_urls: parsed.data.attachment_urls,
      mentioned_user_ids: parsed.data.mentioned_user_ids,
    })
    .select("id")
    .single();
  if (error || !created) return { error: error?.message ?? "Falha ao enviar mensagem" };

  // Notifica @mencionados (best-effort)
  if (parsed.data.mentioned_user_ids.length > 0) {
    const mencionados = parsed.data.mentioned_user_ids.filter((id) => id !== actor.id);
    if (mencionados.length > 0) {
      const preview = parsed.data.conteudo.slice(0, 80) + (parsed.data.conteudo.length > 80 ? "…" : "");
      await dispatchNotification({
        evento_tipo: "task_assigned",
        titulo: `Você foi mencionado em ${channel.nome}`,
        mensagem: `${actor.nome}: ${preview}`,
        link: `/escritorio/${channel.kind}`,
        user_ids_extras: mencionados,
        source_user_id: actor.id,
      });
    }
  }

  // Reply: notifica autor da mensagem original (se for outro)
  if (parsed.data.reply_to_id) {
    const { data: original } = await sb
      .from("chat_messages")
      .select("autor_id")
      .eq("id", parsed.data.reply_to_id)
      .maybeSingle();
    if (original && original.autor_id && original.autor_id !== actor.id) {
      const preview = parsed.data.conteudo.slice(0, 80) + (parsed.data.conteudo.length > 80 ? "…" : "");
      await dispatchNotification({
        evento_tipo: "task_assigned",
        titulo: `Resposta em ${channel.nome}`,
        mensagem: `${actor.nome} respondeu: ${preview}`,
        link: `/escritorio/${channel.kind}`,
        user_ids_extras: [original.autor_id],
        source_user_id: actor.id,
      });
    }
  }

  revalidatePath(`/escritorio/${channel.kind}`);
  return { success: true };
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
  return { success: true };
}

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_ATTACHMENT_TYPES = [
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "application/pdf",
];

export async function uploadChatAttachmentAction(
  formData: FormData,
): Promise<{ error: string } | { success: true; url: string }> {
  await requireAuth();

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Arquivo inválido" };
  if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) {
    return { error: "Tipo não suportado (use JPG, PNG, WebP, GIF ou PDF)" };
  }
  if (file.size > MAX_ATTACHMENT_BYTES) return { error: "Máximo 10MB por arquivo" };
  if (file.size === 0) return { error: "Arquivo vazio" };

  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const filename = `${crypto.randomUUID()}.${ext}`;
  const path = `chat/${filename}`;

  const admin = createServiceRoleClient();
  const arrayBuffer = await file.arrayBuffer();
  const { error: upErr } = await admin.storage
    .from("chat-attachments")
    .upload(path, arrayBuffer, { contentType: file.type, upsert: false });
  if (upErr) return { error: `Falha no upload: ${upErr.message}` };

  const { data: pub } = admin.storage.from("chat-attachments").getPublicUrl(path);
  return { success: true, url: pub.publicUrl };
}
