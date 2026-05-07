// SERVER ONLY
import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { canAccessChannel, type Channel, type ChannelKind, type ChannelWithUnread, type ChatMessage } from "./types";

export const ESCRITORIO_UNREAD_TAG = "chat-unread";
export const ESCRITORIO_MENTIONABLES_TAG = "chat-mentionables";

export async function listChannels(): Promise<Channel[]> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data, error } = await sb
    .from("chat_channels")
    .select("id, kind, nome, descricao, ordem")
    .order("ordem", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Channel[];
}

export async function listAccessibleChannels(userRole: string): Promise<Channel[]> {
  const all = await listChannels();
  return all.filter((c) => canAccessChannel(userRole, c.kind));
}

async function _listChannelsWithUnreadImpl(userId: string, userRole: string): Promise<ChannelWithUnread[]> {
  const channels = await listAccessibleChannels(userRole);
  if (channels.length === 0) return [];

  // Service-role pra rodar dentro de unstable_cache (sem context de cookie).
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const channelIds = channels.map((c) => c.id);
  const { data: readsData } = await sb
    .from("chat_reads")
    .select("channel_id, last_read_at")
    .eq("user_id", userId)
    .in("channel_id", channelIds);
  const lastReadByChannel = new Map(
    ((readsData ?? []) as Array<{ channel_id: string; last_read_at: string }>).map(
      (r) => [r.channel_id, r.last_read_at],
    ),
  );

  const counts = await Promise.all(
    channels.map(async (c) => {
      const since = lastReadByChannel.get(c.id);
      let q = sb
        .from("chat_messages")
        .select("id", { count: "exact", head: true })
        .eq("channel_id", c.id)
        .neq("autor_id", userId);
      if (since) q = q.gt("created_at", since);
      const { count } = await q;
      return count ?? 0;
    }),
  );

  return channels.map((c, i) => ({ ...c, unread_count: counts[i] ?? 0 }));
}

/**
 * Cached por (userId, userRole) por 15s + tag pra invalidação manual quando
 * houver mensagem nova (sendChatMessageAction) ou marcação de lida
 * (markChannelReadAction).
 */
export async function listChannelsWithUnread(userId: string, userRole: string): Promise<ChannelWithUnread[]> {
  const cached = unstable_cache(
    async (uid: string, role: string) => _listChannelsWithUnreadImpl(uid, role),
    ["escritorio-channels-unread"],
    { revalidate: 15, tags: [ESCRITORIO_UNREAD_TAG] },
  );
  return cached(userId, userRole);
}

async function _getChannelByKindImpl(kind: ChannelKind): Promise<Channel | null> {
  // Service-role pra rodar dentro de unstable_cache. chat_channels é tabela
  // seed (sem RLS sensitiva — quem pode ler quê é validado no page-level
  // via canAccessChannel).
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data } = await sb
    .from("chat_channels")
    .select("id, kind, nome, descricao, ordem")
    .eq("kind", kind)
    .maybeSingle();
  return (data as Channel | null) ?? null;
}

/** Cached 5min — canais são seed estático, nunca mudam em runtime. */
export async function getChannelByKind(kind: ChannelKind): Promise<Channel | null> {
  const cached = unstable_cache(
    async (k: string) => _getChannelByKindImpl(k as ChannelKind),
    ["escritorio-channel-by-kind"],
    { revalidate: 300 },
  );
  return cached(kind);
}

export async function listMessages(channelId: string, limit = 50): Promise<ChatMessage[]> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  // Usa nome da COLUNA como hint (mais robusto que nome da FK constraint —
  // PostgREST schema cache às vezes não resolve self-joins via FK name).
  const { data, error } = await sb
    .from("chat_messages")
    .select(`
      id, channel_id, autor_id, conteudo, reply_to_id, attachment_urls, mentioned_user_ids, created_at, updated_at,
      autor:profiles!autor_id(id, nome, avatar_url),
      reply_to:chat_messages!reply_to_id(
        id, conteudo,
        autor:profiles!autor_id(nome)
      )
    `)
    .eq("channel_id", channelId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  type RawRow = ChatMessage & {
    reply_to?: { id: string; conteudo: string; autor: { nome: string } | null } | null;
  };
  const rows = (data ?? []) as RawRow[];
  return rows.reverse().map((r) => ({
    ...r,
    reply_to: r.reply_to
      ? { id: r.reply_to.id, conteudo: r.reply_to.conteudo, autor_nome: r.reply_to.autor?.nome ?? null }
      : null,
  }));
}

async function _listMentionablesImpl(): Promise<Array<{ id: string; nome: string; role: string }>> {
  // Service-role pra rodar dentro de unstable_cache.
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, nome, role")
    .eq("ativo", true)
    .order("nome");
  return (data ?? []) as Array<{ id: string; nome: string; role: string }>;
}

/** Lista de usuários ativos pra autocomplete de @mention. Cached 60s. */
export async function listMentionables(): Promise<Array<{ id: string; nome: string; role: string }>> {
  const cached = unstable_cache(
    async () => _listMentionablesImpl(),
    ["escritorio-mentionables"],
    { revalidate: 60, tags: [ESCRITORIO_MENTIONABLES_TAG] },
  );
  return cached();
}

/** Total de canais com mensagens não lidas — pra badge no nav lateral. Reusa o cache. */
export async function countChannelsWithUnread(userId: string, userRole: string): Promise<number> {
  const channels = await listChannelsWithUnread(userId, userRole);
  return channels.filter((c) => c.unread_count > 0).length;
}
