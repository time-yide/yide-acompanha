import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  listChannelsWithUnread,
  listMessages,
  listMentionables,
} from "@/lib/escritorio/queries";
import { canAccessDmChannel, type Channel } from "@/lib/escritorio/types";
import { ChannelSidebar } from "@/components/escritorio/ChannelSidebar";
import { ChannelView } from "@/components/escritorio/ChannelView";

export default async function DmPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Carrega o channel
  const { data: channelRow } = await sb
    .from("chat_channels")
    .select("id, kind, nome, descricao, ordem, member_ids")
    .eq("id", id)
    .maybeSingle();
  const channel = (channelRow ?? null) as Channel | null;
  if (!channel || !canAccessDmChannel(channel, user.id)) notFound();

  // Resolve display name + avatar do "outro" pra header
  const otherId = (channel.member_ids ?? []).find((mid) => mid !== user.id);
  let otherProfile: { nome: string; avatar_url: string | null } | null = null;
  if (otherId) {
    const { data: p } = await sb
      .from("profiles")
      .select("nome, avatar_url")
      .eq("id", otherId)
      .maybeSingle();
    otherProfile = (p ?? null) as { nome: string; avatar_url: string | null } | null;
  }
  const channelForDisplay: Channel = {
    ...channel,
    nome: otherProfile?.nome ?? "Usuário removido",
  };

  const [messages, sidebarChannels, mentionables, pessoasRes] = await Promise.all([
    listMessages(channel.id, 50),
    listChannelsWithUnread(user.id, user.role),
    listMentionables(),
    sb.from("profiles")
      .select("id, nome, role, avatar_url")
      .eq("ativo", true)
      .neq("id", user.id)
      .order("nome"),
  ]);
  const pessoas = (pessoasRes.data ?? []) as Array<{ id: string; nome: string; role: string; avatar_url: string | null }>;

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-0 flex-col gap-4 md:flex-row">
      <ChannelSidebar
        channels={sidebarChannels}
        currentKind={null}
        currentChannelId={channel.id}
        pessoas={pessoas}
        viewerId={user.id}
      />
      <ChannelView
        key={channel.id}
        channel={channelForDisplay}
        initialMessages={messages}
        currentUser={{ id: user.id, nome: user.nome, avatar_url: user.avatarUrl }}
        mentionables={mentionables}
      />
    </div>
  );
}
