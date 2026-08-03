import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { listChannelsWithUnread } from "@/lib/escritorio/queries";
import { listDeletedChannels } from "@/lib/escritorio/channel-actions";
import { ChannelSidebar } from "@/components/escritorio/ChannelSidebar";
import { getEffectiveUnitId } from "@/lib/units/session";
import { getProfileIdsForActiveUnit } from "@/lib/units/filter-helpers";

// Índice do Escritório = a LISTA de conversas. NÃO redireciona mais pra um canal:
// no mobile a lista é uma tela própria (o botão "voltar" da conversa cai aqui;
// com redirect entraria em loop). No desktop mostra a lista + um placeholder,
// e a conversa abre ao lado ao escolher um canal.
export default async function EscritorioIndexPage() {
  const user = await requireAuth();
  // Multi-tenant: unidade ativa filtra canais role-based + "Pessoas" pra DM.
  const [unitId, unitProfileIds] = await Promise.all([
    getEffectiveUnitId(),
    getProfileIdsForActiveUnit(),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = (await createClient()) as any;
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

  const [channels, deletedChannels, pessoasRes] = await Promise.all([
    listChannelsWithUnread(user.id, user.role, unitId),
    listDeletedChannels(user.role),
    pessoasQ.order("nome"),
  ]);

  if (channels.length === 0) {
    return (
      <div className="mx-auto max-w-2xl py-12">
        <p className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          Você não tem acesso a nenhum canal do Escritório Virtual no momento.
        </p>
      </div>
    );
  }

  const pessoas = (pessoasRes.data ?? []) as Array<{ id: string; nome: string; role: string; avatar_url: string | null }>;

  return (
    <div className="escritorio-shell flex min-h-0 flex-col gap-4 md:flex-row">
      <ChannelSidebar
        channels={channels}
        currentKind={null}
        currentChannelId={null}
        pessoas={pessoas}
        viewerId={user.id}
        viewerRole={user.role}
        deletedChannels={deletedChannels}
      />
      {/* Placeholder só no desktop — no mobile a lista ocupa a tela sozinha. */}
      <div className="hidden flex-1 items-center justify-center rounded-xl border bg-card px-6 text-center text-sm text-muted-foreground md:flex">
        Selecione uma conversa pra começar.
      </div>
    </div>
  );
}
