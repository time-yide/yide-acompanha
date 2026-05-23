"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { authenticateRealtime } from "@/lib/supabase/realtime-auth";
import type { ChatMessage } from "./types";
import { playNotificationSound } from "./notification-sound";

const POLL_INTERVAL_MS = 5000;

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
 * forçar remount quando trocar de canal - assim o initialMessages vira o
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
  // Ref pra polling não depender do state (evita re-criar interval em cada render).
  // Sincroniza via useEffect porque atualizar ref durante render viola a regra
  // react-hooks/refs (referência stale em StrictMode/Concurrent).
  const messagesRef = useRef<ChatMessage[]>(initialMessages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (!channelId) return;
    const supabase = createClient();
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let channelRef: any = null;
    let unsubAuth: (() => void) | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    /**
     * Fetch de mensagens novas (criadas após a mais recente conhecida).
     * Usado tanto pelo realtime (1 msg) quanto pelo polling fallback (várias).
     * Com a mesma função enriquece reply_to.autor_nome.
     */
    async function fetchMessage(messageId: string) {
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
        .eq("id", messageId)
        .maybeSingle();
      if (!data) return null;
      return {
        ...data,
        reply_to: data.reply_to
          ? {
              id: data.reply_to.id,
              conteudo: data.reply_to.conteudo,
              autor_nome: data.reply_to.autor?.nome ?? null,
            }
          : null,
      } as ChatMessage;
    }

    function appendIfNew(msg: ChatMessage) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        if (currentUserId && msg.autor_id !== currentUserId) {
          playNotificationSound();
        }
        return [...prev, msg];
      });
    }

    /**
     * Polling fallback: roda a cada POLL_INTERVAL_MS com a aba visível.
     * Busca msgs com created_at > a mais recente que já temos. Se realtime
     * estiver funcionando, esse fetch é praticamente sempre vazio (nada
     * novo); se realtime falhar (RLS, websocket caiu, etc.), polling
     * garante que mensagens novas apareçam em até 5s.
     */
    async function pollNew() {
      if (cancelled || document.hidden) return;
      const last = messagesRef.current[messagesRef.current.length - 1];
      const since = last?.created_at;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      let q = sb
        .from("chat_messages")
        .select("id, created_at")
        .eq("channel_id", channelId)
        .order("created_at", { ascending: true })
        .limit(50);
      if (since) q = q.gt("created_at", since);
      const { data } = await q;
      const rows = (data ?? []) as Array<{ id: string; created_at: string }>;
      if (rows.length === 0) return;
      // Enriquece em paralelo e adiciona em ordem
      const enriched = await Promise.all(rows.map((r) => fetchMessage(r.id)));
      for (const m of enriched) {
        if (m) appendIfNew(m);
      }
    }

    /**
     * Quando aba volta a ficar visível, força um poll imediato pra
     * recuperar mensagens perdidas enquanto estava em background (iOS
     * suspende websocket; Chrome desktop também aborta após X minutos).
     */
    function onVisibilityChange() {
      if (!document.hidden) void pollNew();
    }

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
            const enriched = await fetchMessage(payload.new.id);
            if (enriched) appendIfNew(enriched);
          },
        )
        .subscribe();

      channelRef = ch;

      // 3. Polling fallback (5s) caso realtime falhe silenciosamente.
      pollTimer = setInterval(() => void pollNew(), POLL_INTERVAL_MS);
      document.addEventListener("visibilitychange", onVisibilityChange);
    }

    void start();

    return () => {
      cancelled = true;
      unsubAuth?.();
      if (channelRef) supabase.removeChannel(channelRef);
      if (pollTimer) clearInterval(pollTimer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [channelId, currentUserId]);

  return { messages, setMessages };
}
