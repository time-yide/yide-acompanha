import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import {
  getChannelByKind,
  listChannelsWithUnread,
  listMessages,
  listMentionables,
} from "@/lib/escritorio/queries";
import { canAccessChannel, type ChannelKind } from "@/lib/escritorio/types";
import { ChannelSidebar } from "@/components/escritorio/ChannelSidebar";
import { ChannelView } from "@/components/escritorio/ChannelView";

const VALID_KINDS: ChannelKind[] = [
  "geral",
  "assessores_coordenadores",
  "coordenadores_estrategico",
  "audiovisual_geral",
  "designers",
  "comercial",
  "administrativo",
];

export default async function CanalPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind: rawKind } = await params;
  if (!(VALID_KINDS as string[]).includes(rawKind)) notFound();
  const kind = rawKind as ChannelKind;

  const user = await requireAuth();
  if (!canAccessChannel(user.role, kind)) notFound();

  const channel = await getChannelByKind(kind);
  if (!channel) notFound();

  const [messages, sidebarChannels, mentionables] = await Promise.all([
    listMessages(channel.id, 50),
    listChannelsWithUnread(user.id, user.role),
    listMentionables(),
  ]);

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-0 flex-col gap-4 md:flex-row">
      <ChannelSidebar channels={sidebarChannels} currentKind={kind} />
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
