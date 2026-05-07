"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
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

    const channel = supabase
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
          // Buscar autor + reply_to (eles vêm cruel do realtime)
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
            // Evita duplicar (caso a mensagem já tenha vindo por outro caminho)
            if (prev.some((m) => m.id === enriched.id)) return prev;
            // Toca o som só pra mensagem de outro usuário (não pra eco do próprio envio).
            if (currentUserId && enriched.autor_id !== currentUserId) {
              playNotificationSound();
            }
            return [...prev, enriched];
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, currentUserId]);

  return { messages, setMessages };
}
