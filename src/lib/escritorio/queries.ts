// SERVER ONLY
import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { canAccessChannel, type Channel, type ChannelDmOther, type ChannelKind, type ChannelWithUnread, type ChatMessage } from "./types";

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

async function _listChannelsWithUnreadImpl(
  userId: string,
  userRole: string,
  unitId: string | null,
): Promise<ChannelWithUnread[]> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // 1. Lista todos os channels acessíveis: role-based (da unidade ativa) + DMs do user.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let roleChannelsQ: any = sb
    .from("chat_channels")
    .select("id, kind, nome, descricao, ordem, member_ids, icon_url, unit_id")
    .neq("kind", "direct")
    .order("ordem", { ascending: true });
  // Multi-tenant: filtra canais role-based pela unidade ativa.
  // unitId null = sem filtro (master vendo "todas" no futuro / migration não rodada).
  if (unitId !== null) {
    roleChannelsQ = roleChannelsQ.eq("unit_id", unitId);
  }
  const { data: roleChannels, error: roleErr } = await roleChannelsQ;
  // Fallback: se a coluna unit_id ainda não existir (migration não rodada),
  // re-tenta sem o filtro pra não esvaziar o chat inteiro.
  let roleChannelsData = roleChannels;
  if (roleErr) {
    const msg = String(roleErr.message ?? "");
    if (msg.includes("unit_id") || msg.includes("schema cache")) {
      console.warn("[escritorio/queries] chat_channels.unit_id não existe, fallback sem filtro:", msg);
      const fb = await sb
        .from("chat_channels")
        .select("id, kind, nome, descricao, ordem, member_ids, icon_url")
        .neq("kind", "direct")
        .order("ordem", { ascending: true });
      roleChannelsData = fb.data;
    } else {
      console.error("[escritorio/queries] listChannelsWithUnread roleChannels failed:", roleErr);
    }
  }

  const accessibleRoleChannels = ((roleChannelsData ?? []) as Channel[])
    .filter((c) => canAccessChannel(userRole, c.kind));

  const { data: dmChannels } = await sb
    .from("chat_channels")
    .select("id, kind, nome, descricao, ordem, member_ids, icon_url")
    .eq("kind", "direct")
    .contains("member_ids", [userId]);

  const allChannels = [...accessibleRoleChannels, ...((dmChannels ?? []) as Channel[])];
  if (allChannels.length === 0) return [];

  const channelIds = allChannels.map((c) => c.id);

  // 2. Reads (pra calcular unread)
  const { data: readsData } = await sb
    .from("chat_reads")
    .select("channel_id, last_read_at")
    .eq("user_id", userId)
    .in("channel_id", channelIds);
  const readMap = new Map<string, string>();
  ((readsData ?? []) as Array<{ channel_id: string; last_read_at: string }>)
    .forEach((r) => readMap.set(r.channel_id, r.last_read_at));

  // 3. Última mensagem por canal (busca top N e agrupa em memória)
  const { data: lastMsgs } = await sb
    .from("chat_messages")
    .select("id, channel_id, autor_id, conteudo, created_at, autor:profiles!autor_id(nome)")
    .in("channel_id", channelIds)
    .order("created_at", { ascending: false })
    .limit(channelIds.length * 5);
  type LastMsgRow = {
    id: string;
    channel_id: string;
    autor_id: string;
    conteudo: string;
    created_at: string;
    autor: { nome: string } | null;
  };
  const firstByChannel = new Map<string, LastMsgRow>();
  ((lastMsgs ?? []) as LastMsgRow[]).forEach((m) => {
    if (!firstByChannel.has(m.channel_id)) firstByChannel.set(m.channel_id, m);
  });

  // 4. Unread por canal — UMA query só, agrupa em memória.
  // Antes: loop com 1 query por canal (N queries pra N canais).
  // Agora: busca todas as msgs novas de TODOS os canais, agrupa.
  // Pra ter o lower bound do "newest read", usamos o min(last_read_at)
  // como filtro grosso e refinamos por canal abaixo.
  const unreadByChannel = new Map<string, number>();
  // Canais sem registro em chat_reads: contam 1 se tem msg de alguém ≠ user
  // (proxy simples; precisão refinada vira após o user marcar como lido).
  for (const cid of channelIds) {
    if (!readMap.has(cid)) {
      const last = firstByChannel.get(cid);
      unreadByChannel.set(cid, last && last.autor_id !== userId ? 1 : 0);
    }
  }

  // Canais COM registro: 1 query agregada filtrando msgs > respective last_read.
  // Como Supabase não suporta múltiplos filtros condicionais por linha, fazemos
  // 1 query por TODOS os canais com lastRead, depois filtramos em memória.
  const channelsWithRead = channelIds.filter((cid) => readMap.has(cid));
  if (channelsWithRead.length > 0) {
    const minLastRead = [...readMap.values()].sort()[0];
    const { data: unreadMsgs } = await sb
      .from("chat_messages")
      .select("channel_id, created_at, autor_id")
      .in("channel_id", channelsWithRead)
      .gt("created_at", minLastRead)
      .neq("autor_id", userId);
    type UnreadMsg = { channel_id: string; created_at: string; autor_id: string };
    const counts = new Map<string, number>();
    ((unreadMsgs ?? []) as UnreadMsg[]).forEach((m) => {
      const lastRead = readMap.get(m.channel_id);
      if (!lastRead) return;
      // Refina: msg só conta se for > last_read_at do canal específico
      if (m.created_at <= lastRead) return;
      counts.set(m.channel_id, (counts.get(m.channel_id) ?? 0) + 1);
    });
    for (const cid of channelsWithRead) {
      unreadByChannel.set(cid, counts.get(cid) ?? 0);
    }
  }

  // 5. Pra DMs, busca nome+avatar do "outro" user
  const dmOtherIds = allChannels
    .filter((c) => c.kind === "direct")
    .map((c) => (c.member_ids ?? []).find((id) => id !== userId) ?? null)
    .filter((id): id is string => id !== null);

  const otherProfiles = new Map<string, { id: string; nome: string; avatar_url: string | null }>();
  if (dmOtherIds.length > 0) {
    const { data: profs } = await sb
      .from("profiles")
      .select("id, nome, avatar_url")
      .in("id", dmOtherIds);
    ((profs ?? []) as Array<{ id: string; nome: string; avatar_url: string | null }>)
      .forEach((p) => otherProfiles.set(p.id, p));
  }

  // 6. Monta o resultado
  const out: ChannelWithUnread[] = allChannels.map((c) => {
    const last = firstByChannel.get(c.id) ?? null;
    let dmOther: ChannelDmOther | null = null;
    if (c.kind === "direct") {
      const otherId = (c.member_ids ?? []).find((id) => id !== userId);
      if (otherId) {
        const p = otherProfiles.get(otherId);
        dmOther = p
          ? { id: p.id, nome: p.nome, avatar_url: p.avatar_url }
          : { id: otherId, nome: "Usuário removido", avatar_url: null };
      }
    }
    return {
      ...c,
      unread_count: unreadByChannel.get(c.id) ?? 0,
      last_message_at: last?.created_at ?? null,
      last_message: last
        ? {
            autor_id: last.autor_id,
            autor_nome: last.autor?.nome ?? "",
            conteudo: last.conteudo,
            created_at: last.created_at,
          }
        : null,
      dm_other: dmOther,
    };
  });

  // 7. Ordena por last_message_at DESC, NULL no final pela ordem do canal
  out.sort((a, b) => {
    if (a.last_message_at && b.last_message_at) {
      return a.last_message_at < b.last_message_at ? 1 : -1;
    }
    if (a.last_message_at) return -1;
    if (b.last_message_at) return 1;
    return a.ordem - b.ordem;
  });

  return out;
}

/**
 * Cached por (userId, userRole, unitId) por 15s + tag pra invalidação manual
 * quando houver mensagem nova (sendChatMessageAction) ou marcação de lida
 * (markChannelReadAction).
 *
 * `unitId`: filtra canais role-based pela unidade ativa. DMs (cross-unit)
 * seguem sempre visíveis pro dono.
 */
export async function listChannelsWithUnread(
  userId: string,
  userRole: string,
  unitId: string | null = null,
): Promise<ChannelWithUnread[]> {
  const cached = unstable_cache(
    async (paramsJson: string) => {
      const { uid, role, uni } = JSON.parse(paramsJson) as { uid: string; role: string; uni: string | null };
      return _listChannelsWithUnreadImpl(uid, role, uni);
    },
    // v2: shape ganhou unitId (multi-tenant)
    ["escritorio-channels-unread-v2"],
    { revalidate: 15, tags: [ESCRITORIO_UNREAD_TAG] },
  );
  return cached(JSON.stringify({ uid: userId, role: userRole, uni: unitId }));
}

async function _getChannelByKindImpl(kind: ChannelKind, unitId: string | null): Promise<Channel | null> {
  // Service-role pra rodar dentro de unstable_cache. chat_channels é tabela
  // seed (sem RLS sensitiva — quem pode ler quê é validado no page-level
  // via canAccessChannel).
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = sb
    .from("chat_channels")
    .select("id, kind, nome, descricao, ordem, unit_id")
    .eq("kind", kind);
  if (unitId !== null) {
    q = q.eq("unit_id", unitId);
  } else {
    // unitId null + migration rodada = múltiplos canais por kind. .limit(1) evita erro.
    q = q.limit(1);
  }
  const { data, error } = unitId !== null ? await q.maybeSingle() : await q;
  if (error) {
    const msg = String(error.message ?? "");
    // Fallback pra ambientes sem unit_id ainda
    if (msg.includes("unit_id") || msg.includes("schema cache")) {
      const fb = await sb
        .from("chat_channels")
        .select("id, kind, nome, descricao, ordem")
        .eq("kind", kind)
        .maybeSingle();
      return (fb.data as Channel | null) ?? null;
    }
    return null;
  }
  // Normaliza: quando passamos .limit(1) (unitId null), data é array; senão é objeto.
  const row = Array.isArray(data) ? (data[0] ?? null) : data;
  return (row as Channel | null) ?? null;
}

/**
 * Cached 5min — canais são seed estático, nunca mudam em runtime.
 *
 * `unitId`: pega o canal dessa unidade. Quando null, pega o primeiro
 * encontrado (fallback pra ambientes pré-migration).
 */
export async function getChannelByKind(
  kind: ChannelKind,
  unitId: string | null = null,
): Promise<Channel | null> {
  const cached = unstable_cache(
    async (k: string, uni: string) => _getChannelByKindImpl(k as ChannelKind, uni === "null" ? null : uni),
    // v2: ganhou unitId
    ["escritorio-channel-by-kind-v2"],
    { revalidate: 300 },
  );
  return cached(kind, unitId ?? "null");
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

async function _listMentionablesImpl(
  unitProfileIds: string[] | null,
): Promise<Array<{ id: string; nome: string; role: string }>> {
  // Service-role pra rodar dentro de unstable_cache.
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase
    .from("profiles")
    .select("id, nome, role")
    .eq("ativo", true);
  if (unitProfileIds !== null) {
    if (unitProfileIds.length === 0) return [];
    q = q.in("id", unitProfileIds);
  }
  const { data } = await q.order("nome");
  return (data ?? []) as Array<{ id: string; nome: string; role: string }>;
}

/**
 * Lista de usuários ativos pra autocomplete de @mention. Cached 60s.
 * `unitProfileIds`: filtra pra só sugerir users da unidade ativa
 * (mention cross-unit não funcionaria — outro user nem vê o canal).
 */
export async function listMentionables(
  unitProfileIds: string[] | null = null,
): Promise<Array<{ id: string; nome: string; role: string }>> {
  const cached = unstable_cache(
    async (paramsJson: string) => {
      const { up } = JSON.parse(paramsJson) as { up: string[] | null };
      return _listMentionablesImpl(up);
    },
    // v2: ganhou unitProfileIds
    ["escritorio-mentionables-v2"],
    { revalidate: 60, tags: [ESCRITORIO_MENTIONABLES_TAG] },
  );
  return cached(JSON.stringify({ up: unitProfileIds }));
}

/** Total de canais com mensagens não lidas — pra badge no nav lateral. Reusa o cache. */
export async function countChannelsWithUnread(
  userId: string,
  userRole: string,
  unitId: string | null = null,
): Promise<number> {
  const channels = await listChannelsWithUnread(userId, userRole, unitId);
  return channels.filter((c) => c.unread_count > 0).length;
}
