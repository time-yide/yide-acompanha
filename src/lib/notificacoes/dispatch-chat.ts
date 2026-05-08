// SERVER ONLY: do not import from client components
import { revalidateTag } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendWebPushToUser } from "@/lib/push/server";
import { canAccessChannel, type ChannelKind } from "@/lib/escritorio/types";

interface DispatchArgs {
  messageId: string;
  channelId: string;
  authorId: string;
  authorName: string;
  channelKind: ChannelKind;
  channelName: string;
  conteudo: string;
  mentionedUserIds: string[];
}

/**
 * Dispatch custom porque cada destinatário precisa de texto/tag diferente:
 * - Mencionados: título "@você foi mencionado em #canal", tag única (não substitui)
 * - Não-mencionados: título "#canal", tag "chat-{channelId}" (próxima msg do
 *   mesmo canal substitui — evita pilha de notifs duplicadas)
 *
 * Bypass intencional do dispatchNotification central (em dispatch.ts) porque
 * aquele envia mesma mensagem pra todos.
 *
 * Recipients: todos os profiles ativos com role que tem acesso ao canal,
 * exceto o autor.
 */
export async function dispatchChatNotification(args: DispatchArgs): Promise<void> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Resolve destinatários: profiles ativos com acesso ao canal
  const { data: profilesData } = await sb
    .from("profiles")
    .select("id, role, ativo")
    .eq("ativo", true);
  const profiles = (profilesData ?? []) as Array<{ id: string; role: string }>;

  const recipientIds = profiles
    .filter((p) => p.id !== args.authorId)
    .filter((p) => canAccessChannel(p.role, args.channelKind))
    .map((p) => p.id);

  if (recipientIds.length === 0) return;

  const mentionedSet = new Set(args.mentionedUserIds);
  const preview = args.conteudo.length > 100
    ? args.conteudo.slice(0, 100) + "…"
    : args.conteudo;
  const link = `/escritorio/${args.channelKind}`;

  // Insert in-app notifications em batch
  const rows = recipientIds.map((uid) => {
    const isMentioned = mentionedSet.has(uid);
    return {
      user_id: uid,
      tipo: "chat_mensagem" as const,
      titulo: isMentioned
        ? `@você foi mencionado em #${args.channelName}`
        : `#${args.channelName}`,
      mensagem: `${args.authorName}: ${preview}`,
      link,
    };
  });

  const { error } = await sb.from("notifications").insert(rows);
  if (error) console.error("[dispatch-chat] in-app insert failed:", error.message);

  // Web push em paralelo
  await Promise.all(
    recipientIds.map(async (uid) => {
      const isMentioned = mentionedSet.has(uid);
      try {
        await sendWebPushToUser(uid, {
          title: isMentioned
            ? `@você foi mencionado em #${args.channelName}`
            : `#${args.channelName}`,
          body: `${args.authorName}: ${preview}`,
          url: link,
          // Mencionados: tag único pra não substituir notif anterior
          // Não-mencionados: mesmo canal compartilha tag → última msg
          // do canal aparece, anteriores somem (UX limpa pra canal ativo)
          tag: isMentioned ? `chat-mention-${args.messageId}` : `chat-${args.channelId}`,
        });
      } catch (e) {
        console.error("[dispatch-chat] push failed for user", uid, e);
      }
    }),
  );

  // Invalida contador do sininho pros destinatários
  revalidateTag("notifications", "default");
}
