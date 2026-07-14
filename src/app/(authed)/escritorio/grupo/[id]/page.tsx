import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  listChannelsWithUnread,
  listMessages,
  listMentionables,
} from "@/lib/escritorio/queries";
import { canAccessGroupChannel, type Channel } from "@/lib/escritorio/types";
import { ChannelSidebar } from "@/components/escritorio/ChannelSidebar";
import { listDeletedChannels } from "@/lib/escritorio/channel-actions";
import { ChannelView } from "@/components/escritorio/ChannelView";
import { getEffectiveUnitId } from "@/lib/units/session";
import { getProfileIdsForActiveUnit } from "@/lib/units/filter-helpers";

export default async function GrupoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data: channelRow } = await sb
    .from("chat_channels")
    .select("id, kind, nome, descricao, ordem, member_ids, icon_url, created_by")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  const channel = (channelRow ?? null) as Channel | null;
  if (!channel || !canAccessGroupChannel(channel, user.id)) notFound();

  const [unitId, unitProfileIds] = await Promise.all([
    getEffectiveUnitId(),
    getProfileIdsForActiveUnit(),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pessoasQ: any = sb.from("profiles")
    .select("id, nome, role, avatar_url")
    .eq("ativo", true)
    .neq("id", user.id);
  if (unitProfileIds !== null) {
    if (unitProfileIds.length === 0) {
      pessoasQ = pessoasQ.eq("id", "00000000-0000-0000-0000-000000000000");
    } else {
      pessoasQ = pessoasQ.in("id", unitProfileIds);
    }
  }
  const [messages, sidebarChannels, mentionables, pessoasRes, deletedChannels] = await Promise.all([
    listMessages(channel.id, 50),
    listChannelsWithUnread(user.id, user.role, unitId),
    listMentionables(unitProfileIds),
    pessoasQ.order("nome"),
    listDeletedChannels(user.role),
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
        viewerRole={user.role}
        deletedChannels={deletedChannels}
      />
      <ChannelView
        key={channel.id}
        channel={channel}
        initialMessages={messages}
        currentUser={{ id: user.id, nome: user.nome, avatar_url: user.avatarUrl }}
        mentionables={mentionables}
      />
    </div>
  );
}
