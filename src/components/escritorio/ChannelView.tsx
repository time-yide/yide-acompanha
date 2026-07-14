"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Hash } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
import { useRealtimeMessages } from "@/lib/escritorio/use-realtime-messages";
import { useRealtimeReads } from "@/lib/escritorio/use-realtime-reads";
import { markChannelReadAction } from "@/lib/escritorio/actions";
import type { Channel, ChatMessage, ChannelRead } from "@/lib/escritorio/types";
import { APP_TIMEZONE, getDatePartsInAppTz } from "@/lib/datetime/timezone";

function sameDay(a: string, b: string): boolean {
  const pa = getDatePartsInAppTz(new Date(a));
  const pb = getDatePartsInAppTz(new Date(b));
  return pa.year === pb.year && pa.month === pb.month && pa.day === pb.day;
}

function formatDateDivider(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const dParts = getDatePartsInAppTz(d);
  const todayParts = getDatePartsInAppTz(now);

  // "Ontem" = today - 1 dia no fuso da app.
  const yesterdayUtcMs = Date.UTC(
    parseInt(todayParts.year, 10),
    parseInt(todayParts.month, 10) - 1,
    parseInt(todayParts.day, 10) - 1,
    12,
    0,
    0,
  );
  const yesterdayParts = getDatePartsInAppTz(new Date(yesterdayUtcMs));

  const isToday =
    dParts.year === todayParts.year &&
    dParts.month === todayParts.month &&
    dParts.day === todayParts.day;
  if (isToday) return "Hoje";

  const isYesterday =
    dParts.year === yesterdayParts.year &&
    dParts.month === yesterdayParts.month &&
    dParts.day === yesterdayParts.day;
  if (isYesterday) return "Ontem";

  return d.toLocaleDateString("pt-BR", {
    timeZone: APP_TIMEZONE,
    day: "2-digit",
    month: "long",
    year: dParts.year === todayParts.year ? undefined : "numeric",
  });
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
  /** Leituras do canal (read receipts "quem leu"). */
  initialReads?: ChannelRead[];
}

export function ChannelView({ channel, initialMessages, currentUser, mentionables, initialReads = [] }: Props) {
  const { messages, setMessages } = useRealtimeMessages(channel.id, initialMessages, currentUser.id);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);

  // Read receipts: nome/avatar por user pra resolver quem aparece via realtime.
  const profilesById = useMemo(() => {
    const map: Record<string, { nome: string; avatar_url: string | null }> = {};
    for (const m of mentionables) map[m.id] = { nome: m.nome, avatar_url: null };
    for (const r of initialReads) map[r.user_id] = { nome: r.nome, avatar_url: r.avatar_url };
    map[currentUser.id] = { nome: currentUser.nome, avatar_url: currentUser.avatar_url };
    return map;
  }, [mentionables, initialReads, currentUser]);

  const reads = useRealtimeReads(channel.id, initialReads, profilesById);

  // Pra cada mensagem minha: quem já leu (last_read_at >= created_at, exceto eu).
  function readersOf(message: ChatMessage): ChannelRead[] {
    const out: ChannelRead[] = [];
    for (const r of reads.values()) {
      if (r.user_id === currentUser.id) continue;
      if (r.last_read_at >= message.created_at) out.push(r);
    }
    return out;
  }

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
                  readers={m.autor_id === currentUser.id ? readersOf(m) : undefined}
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
