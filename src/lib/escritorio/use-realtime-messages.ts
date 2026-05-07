"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { authenticateRealtime } from "@/lib/supabase/realtime-auth";
import type { ChatMessage } from "./types";
import { playNotificationSound } from "./notification-sound";

interface RealtimePayload {
  new: {
    id: string;
    channel_id: string;
    autor_id: string;
    conteudo: string;
    reply_to_id: string | null;
    attachment_urls: string[];
    mentioned_user_ids: string[];
    created_at: string;
    updated_at: string | null;
  };
}

/**
 * Subscribe a inserts em chat_messages do canal. Quando chega uma nova mensagem,
 * faz fetch dos dados completos (com autor + reply_to) e adiciona ao state.
 *
 * Importante: o caller deve passar `key={channel.id}` no componente pai pra
 * forçar remount quando trocar de canal — assim o initialMessages vira o
 * novo state inicial sem precisar de useEffect+setState (que viola
 * react-hooks/set-state-in-effect).
 *
 * Auth do Realtime: o @supabase/ssr não propaga o JWT pro websocket
 * automaticamente, então RLS roda como anônimo e dropa os eventos
 * silenciosamente. A gente força realtime.setAuth() antes de subscribe e
 * re-aplica em mudanças de auth (refresh de token).
 */
export function useRealtimeMessages(
  channelId: string | null,
  initialMessages: ChatMessage[],
  currentUserId?: string,
) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);

  useEffect(() => {
    if (!channelId) return;
    const supabase = createClient();
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let channelRef: any = null;
    let unsubAuth: (() => void) | null = null;

    async function start() {
      // 1. Autentica o websocket (ver src/lib/supabase/realtime-auth.ts)
      unsubAuth = await authenticateRealtime(supabase);
      if (cancelled) return;

      // 2. Subscribe no canal de postgres_changes.
      const ch = supabase
        .channel(`chat:${channelId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "chat_messages",
            filter: `channel_id=eq.${channelId}`,
          },
          async (payload: RealtimePayload) => {
            const newMsg = payload.new;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const sb = supabase as any;
            const { data } = await sb
              .from("chat_messages")
              .select(`
                id, channel_id, autor_id, conteudo, reply_to_id, attachment_urls, mentioned_user_ids, created_at, updated_at,
                autor:profiles!autor_id(id, nome, avatar_url),
                reply_to:chat_messages!reply_to_id(
                  id, conteudo,
                  autor:profiles!autor_id(nome)
                )
              `)
              .eq("id", newMsg.id)
              .maybeSingle();

            if (!data) return;
            const enriched = {
              ...data,
              reply_to: data.reply_to
                ? {
                    id: data.reply_to.id,
                    conteudo: data.reply_to.conteudo,
                    autor_nome: data.reply_to.autor?.nome ?? null,
                  }
                : null,
            } as ChatMessage;

            setMessages((prev) => {
              if (prev.some((m) => m.id === enriched.id)) return prev;
              if (currentUserId && enriched.autor_id !== currentUserId) {
                playNotificationSound();
              }
              return [...prev, enriched];
            });
          },
        )
        .subscribe();

      channelRef = ch;
    }

    void start();

    return () => {
      cancelled = true;
      unsubAuth?.();
      if (channelRef) supabase.removeChannel(channelRef);
    };
  }, [channelId, currentUserId]);

  return { messages, setMessages };
}
