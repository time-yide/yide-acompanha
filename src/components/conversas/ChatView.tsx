"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MessageCircle, Lock, Loader2 } from "lucide-react";
import { ChatHeader } from "./ChatHeader";
import { ChatInput } from "./ChatInput";
import { MessageBubble } from "./MessageBubble";
import { sendWppMessageAction, markConversationReadAction } from "@/lib/conversas/actions";
import type { WppConversation, WppMessage } from "@/lib/conversas/types";
import { APP_TIMEZONE, getTodayDate } from "@/lib/datetime/timezone";

interface Props {
  conversa: WppConversation | null;
  initialMessages?: WppMessage[];
}

function agruparPorDia(mensagens: WppMessage[]): Array<{ dia: string; rotulo: string; itens: WppMessage[] }> {
  const grupos = new Map<string, WppMessage[]>();
  for (const m of mensagens) {
    const dia = m.created_at.slice(0, 10);
    const cur = grupos.get(dia) ?? [];
    cur.push(m);
    grupos.set(dia, cur);
  }
  const hoje = getTodayDate();
  const ontem = getTodayDate(new Date(Date.now() - 86400000));

  return [...grupos.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dia, itens]) => {
      let rotulo: string;
      if (dia === hoje) rotulo = "Hoje";
      else if (dia === ontem) rotulo = "Ontem";
      else {
        const d = new Date(`${dia}T12:00:00`);
        const diffDias = (Date.now() - d.getTime()) / 86400000;
        rotulo = diffDias < 7
          ? d.toLocaleDateString("pt-BR", { timeZone: APP_TIMEZONE, weekday: "long" })
          : d.toLocaleDateString("pt-BR", { timeZone: APP_TIMEZONE, day: "2-digit", month: "long", year: "numeric" });
      }
      return { dia, rotulo, itens };
    });
}

const WALLPAPER_CLASSES =
  "bg-[radial-gradient(circle_at_top_left,theme(colors.emerald.500/0.04),transparent_40%),radial-gradient(circle_at_bottom_right,theme(colors.teal.500/0.04),transparent_40%)]";

export function ChatView({ conversa, initialMessages }: Props) {
  const [messages, setMessages] = useState<WppMessage[]>(initialMessages ?? []);
  const [loading, setLoading] = useState(!initialMessages && !!conversa);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!conversa) return;
    if (!initialMessages) {
      fetch(`/api/conversas/messages?conversationId=${conversa.id}`)
        .then((r) => r.json())
        .then((data) => setMessages(data as WppMessage[]))
        .catch(() => setMessages([]))
        .finally(() => setLoading(false));
    }
    markConversationReadAction(conversa.id).catch(() => {});
  }, [conversa?.id, initialMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Poll for new messages every 5s
  useEffect(() => {
    if (!conversa) return;
    const interval = setInterval(async () => {
      try {
        const r = await fetch(`/api/conversas/messages?conversationId=${conversa.id}`);
        if (r.ok) {
          const data = await r.json();
          setMessages(data as WppMessage[]);
        }
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [conversa?.id]);

  const handleSend = useCallback(async (texto: string) => {
    if (!conversa || sending) return;
    setSending(true);
    try {
      const result = await sendWppMessageAction(conversa.id, texto);
      if ("error" in result) {
        alert(result.error);
      } else {
        // Refresh messages
        const r = await fetch(`/api/conversas/messages?conversationId=${conversa.id}`);
        if (r.ok) {
          setMessages(await r.json() as WppMessage[]);
        }
      }
    } catch {
      alert("Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  }, [conversa?.id, sending]);

  if (!conversa) {
    return (
      <div className={`flex h-full flex-1 flex-col items-center justify-center gap-4 ${WALLPAPER_CLASSES} bg-muted/20`}>
        <div className="rounded-full bg-emerald-500/10 p-8">
          <MessageCircle className="h-16 w-16 text-emerald-500/60" />
        </div>
        <div className="max-w-md text-center space-y-2 px-6">
          <h2 className="text-xl font-light tracking-tight">Conversas Yide</h2>
          <p className="text-sm text-muted-foreground">
            Inbox unificada de WhatsApp. Selecione uma conversa à esquerda pra começar.
          </p>
        </div>
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Lock className="h-3 w-3" />
          Mensagens via Twilio WhatsApp Business API.
        </p>
      </div>
    );
  }

  const grupos = agruparPorDia(messages);

  return (
    <div className={`flex h-full flex-1 flex-col ${WALLPAPER_CLASSES}`}>
      <ChatHeader conversa={conversa} />

      <div className="flex-1 space-y-4 overflow-y-auto px-3 py-4 sm:px-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Nenhuma mensagem nessa conversa ainda.
          </p>
        ) : (
          grupos.map((g) => (
            <div key={g.dia} className="space-y-2">
              <div className="flex justify-center">
                <span className="rounded-full bg-card/80 backdrop-blur-sm px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground shadow-sm">
                  {g.rotulo}
                </span>
              </div>
              {g.itens.map((m) => (
                <MessageBubble key={m.id} mensagem={m} />
              ))}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <ChatInput onSend={handleSend} sending={sending} />
    </div>
  );
}
