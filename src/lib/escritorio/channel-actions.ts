"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import { ESCRITORIO_UNREAD_TAG } from "./queries";
import { canDeleteChannel, canCreateGroup, canManageGroup, type Channel } from "./types";

interface ChannelActionResult {
  success?: boolean;
  error?: string;
}

interface GroupCreateResult {
  success?: boolean;
  error?: string;
  channelId?: string;
}

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function sanitizeMemberIds(raw: unknown, creatorId: string): string[] {
  const arr = Array.isArray(raw) ? raw : [];
  const ids = arr.filter((x): x is string => typeof x === "string" && UUID_RE.test(x));
  // O criador sempre entra no grupo.
  return [...new Set([...ids, creatorId])];
}

/**
 * Cria um grupo customizado (kind='grupo') com nome + membros escolhidos.
 * Só adm/sócio. O criador entra automaticamente como membro.
 */
export async function createGroupAction(
  nome: string,
  memberIds: string[],
): Promise<GroupCreateResult> {
  const actor = await requireAuth();
  if (!canCreateGroup(actor.role)) return { error: "Apenas adm/sócio podem criar grupos" };

  const nomeTrim = (nome ?? "").trim();
  if (nomeTrim.length < 2) return { error: "Dê um nome ao grupo (mín. 2 caracteres)" };
  if (nomeTrim.length > 80) return { error: "Nome muito longo (máx. 80)" };

  const members = sanitizeMemberIds(memberIds, actor.id);
  if (members.length < 2) return { error: "Escolha ao menos 1 pessoa pro grupo" };

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data, error } = await sb
    .from("chat_channels")
    .insert({
      kind: "grupo",
      nome: nomeTrim,
      descricao: null,
      ordem: 0,
      member_ids: members,
      created_by: actor.id,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Falha ao criar grupo" };

  revalidateTag(ESCRITORIO_UNREAD_TAG, "default");
  revalidatePath("/escritorio");
  return { success: true, channelId: data.id as string };
}

/**
 * Edita um grupo (nome e/ou membros). Quem criou, ou adm/sócio.
 */
export async function updateGroupAction(
  channelId: string,
  nome: string,
  memberIds: string[],
): Promise<ChannelActionResult> {
  const actor = await requireAuth();
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data: channel } = await sb
    .from("chat_channels")
    .select("id, kind, nome, descricao, ordem, member_ids, icon_url, created_by")
    .eq("id", channelId)
    .maybeSingle();
  if (!channel) return { error: "Grupo não encontrado" };
  if (!canManageGroup(channel as unknown as Channel, actor.id, actor.role)) {
    return { error: "Sem permissão pra editar este grupo" };
  }

  const nomeTrim = (nome ?? "").trim();
  if (nomeTrim.length < 2) return { error: "Nome do grupo muito curto" };
  if (nomeTrim.length > 80) return { error: "Nome muito longo (máx. 80)" };

  // O criador continua no grupo mesmo que não seja marcado.
  const creatorId = (channel as { created_by?: string | null }).created_by ?? actor.id;
  const members = sanitizeMemberIds(memberIds, creatorId);
  if (members.length < 2) return { error: "O grupo precisa de ao menos 2 pessoas" };

  const { error } = await sb
    .from("chat_channels")
    .update({ nome: nomeTrim, member_ids: members })
    .eq("id", channelId);
  if (error) return { error: error.message };

  revalidateTag(ESCRITORIO_UNREAD_TAG, "default");
  revalidatePath("/escritorio");
  return { success: true };
}

/**
 * Apaga um grupo (soft delete). Quem criou, ou adm/sócio.
 */
export async function deleteGroupAction(channelId: string): Promise<ChannelActionResult> {
  const actor = await requireAuth();
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data: channel } = await sb
    .from("chat_channels")
    .select("id, kind, nome, member_ids, created_by")
    .eq("id", channelId)
    .maybeSingle();
  if (!channel) return { error: "Grupo não encontrado" };
  if (!canManageGroup(channel as unknown as Channel, actor.id, actor.role)) {
    return { error: "Sem permissão pra apagar este grupo" };
  }

  const { error } = await sb
    .from("chat_channels")
    .update({ deleted_at: new Date().toISOString(), deleted_by: actor.id })
    .eq("id", channelId)
    .eq("kind", "grupo");
  if (error) return { error: error.message };

  revalidateTag(ESCRITORIO_UNREAD_TAG, "default");
  revalidatePath("/escritorio");
  return { success: true };
}

export interface DeletedChannel {
  id: string;
  kind: string;
  nome: string;
  deleted_at: string;
}

/** Soft delete de canal fixo. Só sócio. Nunca DM. */
export async function deleteChannelAction(channelId: string): Promise<ChannelActionResult> {
  const actor = await requireAuth();
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data: channel } = await sb
    .from("chat_channels")
    .select("id, kind, nome, descricao, ordem, member_ids, icon_url")
    .eq("id", channelId)
    .maybeSingle();
  if (!channel) return { error: "Canal não encontrado" };

  if (!canDeleteChannel(actor.role, channel as unknown as Channel)) {
    return { error: "Apenas sócio pode excluir canais" };
  }

  const { error } = await sb
    .from("chat_channels")
    .update({ deleted_at: new Date().toISOString(), deleted_by: actor.id })
    .eq("id", channelId)
    .is("deleted_at", null);
  if (error) return { error: error.message };

  revalidateTag(ESCRITORIO_UNREAD_TAG, "default");
  revalidatePath("/escritorio");
  return { success: true };
}

/** Restaura um canal soft-deletado. Só sócio. */
export async function restoreChannelAction(channelId: string): Promise<ChannelActionResult> {
  const actor = await requireAuth();
  if (actor.role !== "socio") return { error: "Apenas sócio pode restaurar canais" };

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { error } = await sb
    .from("chat_channels")
    .update({ deleted_at: null, deleted_by: null })
    .eq("id", channelId)
    .neq("kind", "direct"); // defensivo: DMs nunca são soft-deletados/restaurados
  if (error) return { error: error.message };

  revalidateTag(ESCRITORIO_UNREAD_TAG, "default");
  revalidatePath("/escritorio");
  return { success: true };
}

/** Lista canais soft-deletados (só pro sócio ver/restaurar). */
export async function listDeletedChannels(role: string): Promise<DeletedChannel[]> {
  if (role !== "socio") return [];
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data, error } = await sb
    .from("chat_channels")
    .select("id, kind, nome, deleted_at")
    // Não referencia 'grupo' (enum pode não existir antes da migration). Grupos
    // apagados podem aparecer aqui pro sócio restaurar — comportamento aceitável.
    .neq("kind", "direct")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });
  if (error) {
    // Pré-migration: coluna deleted_at não existe → sem canais excluídos.
    console.warn("[escritorio] listDeletedChannels:", error.message);
    return [];
  }
  return (data ?? []) as DeletedChannel[];
}
