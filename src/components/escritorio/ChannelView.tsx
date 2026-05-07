"use client";

import { useEffect, useRef, useState } from "react";
import { Hash } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
import { useRealtimeMessages } from "@/lib/escritorio/use-realtime-messages";
import { markChannelReadAction } from "@/lib/escritorio/actions";
import type { Channel, ChatMessage } from "@/lib/escritorio/types";

interface Props {
  channel: Channel;
  initialMessages: ChatMessage[];
  currentUserId: string;
  mentionables: Array<{ id: string; nome: string; role: string }>;
}

export function ChannelView({ channel, initialMessages, currentUserId, mentionables }: Props) {
  const { messages } = useRealtimeMessages(channel.id, initialMessages, currentUserId);
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

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <p className="py-12 text-center text-sm italic text-muted-foreground">
            Sem mensagens ainda. Comece a conversa.
          </p>
        ) : (
          messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              isMine={m.autor_id === currentUserId}
              onReply={() => setReplyTo(m)}
            />
          ))
        )}
      </div>

      <div className="border-t p-3">
        <MessageInput
          channelId={channel.id}
          mentionables={mentionables}
          replyTo={replyTo}
          onClearReply={() => setReplyTo(null)}
        />
      </div>
    </div>
  );
}
