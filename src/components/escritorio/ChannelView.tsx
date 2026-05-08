"use client";

import { useEffect, useRef, useState } from "react";
import { Hash } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
import { useRealtimeMessages } from "@/lib/escritorio/use-realtime-messages";
import { markChannelReadAction } from "@/lib/escritorio/actions";
import type { Channel, ChatMessage } from "@/lib/escritorio/types";

function sameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function formatDateDivider(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  ) return "Hoje";
  if (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  ) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

function DateDivider({ iso }: { iso: string }) {
  return (
    <div className="my-3 flex justify-center">
      <span className="rounded-full bg-card border px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground shadow-sm">
        {formatDateDivider(iso)}
      </span>
    </div>
  );
}

export interface CurrentUser {
  id: string;
  nome: string;
  avatar_url: string | null;
}

interface Props {
  channel: Channel;
  initialMessages: ChatMessage[];
  currentUser: CurrentUser;
  mentionables: Array<{ id: string; nome: string; role: string }>;
}

export function ChannelView({ channel, initialMessages, currentUser, mentionables }: Props) {
  const { messages, setMessages } = useRealtimeMessages(channel.id, initialMessages, currentUser.id);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);

  // Auto-scroll pra última mensagem
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  // Marca como lido ao montar e quando chegam mensagens novas
  useEffect(() => {
    const fd = new FormData();
    fd.set("channel_id", channel.id);
    void markChannelReadAction(fd);
  }, [channel.id, messages.length]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col rounded-xl border bg-card">
      <header className="border-b px-4 py-3">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Hash className="h-4 w-4 text-muted-foreground" />
          {channel.nome}
        </h2>
        {channel.descricao && (
          <p className="mt-0.5 text-xs text-muted-foreground">{channel.descricao}</p>
        )}
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-muted/10 px-3 py-3 sm:px-4">
        {messages.length === 0 ? (
          <p className="py-12 text-center text-sm italic text-muted-foreground">
            Sem mensagens ainda. Comece a conversa.
          </p>
        ) : (
          messages.map((m, idx) => {
            const prev = idx > 0 ? messages[idx - 1] : null;
            const showDateDivider = !prev || !sameDay(prev.created_at, m.created_at);
            return (
              <div key={m.id}>
                {showDateDivider && <DateDivider iso={m.created_at} />}
                <MessageBubble
                  message={m}
                  isMine={m.autor_id === currentUser.id}
                  prev={showDateDivider ? null : prev}
                  onReply={() => setReplyTo(m)}
                />
              </div>
            );
          })
        )}
      </div>

      <div className="border-t p-3">
        <MessageInput
          channelId={channel.id}
          mentionables={mentionables}
          replyTo={replyTo}
          onClearReply={() => setReplyTo(null)}
          currentUser={currentUser}
          setMessages={setMessages}
        />
      </div>
    </div>
  );
}
