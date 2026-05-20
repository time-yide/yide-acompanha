import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  getChannelByKind,
  listChannelsWithUnread,
  listMessages,
  listMentionables,
} from "@/lib/escritorio/queries";
import { canAccessChannel, type ChannelKind } from "@/lib/escritorio/types";
import { ChannelSidebar } from "@/components/escritorio/ChannelSidebar";
import { ChannelView } from "@/components/escritorio/ChannelView";
import { getEffectiveUnitId } from "@/lib/units/session";
import { getProfileIdsForActiveUnit } from "@/lib/units/filter-helpers";

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

  // Multi-tenant: pega o canal da unidade ativa + filtra sidebar/mentionables.
  const [unitId, unitProfileIds] = await Promise.all([
    getEffectiveUnitId(),
    getProfileIdsForActiveUnit(),
  ]);

  const channel = await getChannelByKind(kind, unitId);
  if (!channel) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = (await createClient()) as any;
  // DM autocomplete ("Pessoas") só de quem está na mesma unidade.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pessoasQ: any = sb.from("profiles")
    .select("id, nome, role, avatar_url")
    .eq("ativo", true)
    .neq("id", user.id);
  if (unitProfileIds !== null) {
    if (unitProfileIds.length === 0) {
      // Unidade vazia, ninguém pra conversar
      pessoasQ = pessoasQ.eq("id", "00000000-0000-0000-0000-000000000000");
    } else {
      pessoasQ = pessoasQ.in("id", unitProfileIds);
    }
  }
  const [messages, sidebarChannels, mentionables, pessoasRes] = await Promise.all([
    listMessages(channel.id, 50),
    listChannelsWithUnread(user.id, user.role, unitId),
    listMentionables(unitProfileIds),
    pessoasQ.order("nome"),
  ]);
  const pessoas = (pessoasRes.data ?? []) as Array<{ id: string; nome: string; role: string; avatar_url: string | null }>;

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-0 flex-col gap-4 md:flex-row">
      <ChannelSidebar
        channels={sidebarChannels}
        currentKind={kind}
        currentChannelId={null}
        pessoas={pessoas}
        viewerId={user.id}
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
