"use client";

import { useState } from "react";
import Link from "next/link";
import { Hash, MessageSquarePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatRelativeChatTime } from "@/lib/escritorio/format-relative";
import { NovoDmModal } from "./NovoDmModal";
import type { ChannelWithUnread } from "@/lib/escritorio/types";

function initials(nome: string | undefined | null): string {
  if (!nome) return "—";
  const parts = nome.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface Pessoa {
  id: string;
  nome: string;
  role: string;
  avatar_url: string | null;
}

interface Props {
  channels: ChannelWithUnread[];
  /** Pro highlight de canais não-DM (kind). null se a página ativa é um DM. */
  currentKind: string | null;
  /** Pro highlight do DM ativo (channel id). null se a página ativa é um canal de grupo. */
  currentChannelId?: string | null;
  /** Lista de profiles ativos pra abrir nova DM (sem incluir o próprio user). */
  pessoas: Pessoa[];
  viewerId: string;
}

export function ChannelSidebar({ channels, currentKind, currentChannelId, pessoas, viewerId }: Props) {
  const [novoOpen, setNovoOpen] = useState(false);

  return (
    <aside className="flex w-full flex-col rounded-xl border bg-card md:w-72">
      <div className="flex items-center justify-between border-b px-3 py-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Conversas
        </h2>
        <button
          type="button"
          onClick={() => setNovoOpen(true)}
          className="rounded-md p-1.5 text-primary hover:bg-primary/10"
          aria-label="Nova conversa"
          title="Nova conversa"
        >
          <MessageSquarePlus className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {channels.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm italic text-muted-foreground">
            Sem conversas ainda. Inicia uma com o botão acima.
          </p>
        ) : (
          channels.map((c) => {
            const isDm = c.kind === "direct";
            const displayName = isDm ? (c.dm_other?.nome ?? "Usuário removido") : c.nome;
            const avatarSrc = isDm ? c.dm_other?.avatar_url : null;
            const active = isDm
              ? c.id === currentChannelId
              : c.kind === currentKind;
            const href = isDm ? `/escritorio/dm/${c.id}` : `/escritorio/${c.kind}`;

            const preview = c.last_message;
            const previewText = preview
              ? `${preview.autor_id === viewerId ? "Você: " : ""}${preview.conteudo}`
              : null;

            return (
              <Link
                key={c.id}
                href={href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 transition-colors",
                  active ? "bg-primary/10" : "hover:bg-muted/50",
                )}
              >
                <Avatar className="h-10 w-10 flex-shrink-0">
                  {avatarSrc ? <AvatarImage src={avatarSrc} alt={displayName} /> : null}
                  <AvatarFallback className="text-xs">
                    {isDm ? initials(displayName) : <Hash className="h-4 w-4 text-muted-foreground" />}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={cn("truncate text-sm font-medium", active && "text-primary")}>
                      {displayName}
                    </span>
                    {c.last_message_at && (
                      <span className="flex-shrink-0 text-[11px] text-muted-foreground">
                        {formatRelativeChatTime(c.last_message_at)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs text-muted-foreground">
                      {previewText ?? <span className="italic">sem mensagens</span>}
                    </p>
                    {c.unread_count > 0 && (
                      <span className="inline-flex h-5 min-w-[1.25rem] flex-shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                        {c.unread_count > 99 ? "99+" : c.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>

      <NovoDmModal open={novoOpen} onOpenChange={setNovoOpen} pessoas={pessoas} />
    </aside>
  );
}
