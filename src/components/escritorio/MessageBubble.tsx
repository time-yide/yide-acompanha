"use client";

import { ExternalLink, FileText, Reply } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { ChatMessage } from "@/lib/escritorio/types";
import { cn } from "@/lib/utils";

function initials(nome: string | undefined | null): string {
  if (!nome) return "—";
  const parts = nome.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const PALETTE = [
  "bg-emerald-500/30 text-emerald-700 dark:text-emerald-300",
  "bg-sky-500/30 text-sky-700 dark:text-sky-300",
  "bg-amber-500/30 text-amber-700 dark:text-amber-300",
  "bg-rose-500/30 text-rose-700 dark:text-rose-300",
  "bg-violet-500/30 text-violet-700 dark:text-violet-300",
  "bg-teal-500/30 text-teal-700 dark:text-teal-300",
  "bg-orange-500/30 text-orange-700 dark:text-orange-300",
  "bg-pink-500/30 text-pink-700 dark:text-pink-300",
];

const NAME_PALETTE = [
  "text-emerald-600 dark:text-emerald-400",
  "text-sky-600 dark:text-sky-400",
  "text-amber-600 dark:text-amber-400",
  "text-rose-600 dark:text-rose-400",
  "text-violet-600 dark:text-violet-400",
  "text-teal-600 dark:text-teal-400",
  "text-orange-600 dark:text-orange-400",
  "text-pink-600 dark:text-pink-400",
];

function paletteIndex(userId: string | undefined | null): number {
  if (!userId) return 0;
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  return Math.abs(hash) % PALETTE.length;
}

function avatarBg(userId: string | undefined | null): string {
  return PALETTE[paletteIndex(userId)];
}

function nameColor(userId: string | undefined | null): string {
  return NAME_PALETTE[paletteIndex(userId)];
}

function formatHourMinute(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

const MENTION_OR_URL = /(@[\w.\-áéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ]+)|(https?:\/\/[^\s]+)/g;

function renderConteudo(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  const re = new RegExp(MENTION_OR_URL.source, "g");
  while ((match = re.exec(text))) {
    if (match.index > lastIdx) parts.push(text.slice(lastIdx, match.index));
    if (match[1]) {
      parts.push(
        <span key={`m-${i}`} className="rounded bg-primary/15 px-1 py-0.5 text-primary font-medium">{match[1]}</span>,
      );
    } else if (match[2]) {
      parts.push(
        <a key={`l-${i}`} href={match[2]} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">
          {match[2]}
        </a>,
      );
    }
    lastIdx = match.index + match[0].length;
    i += 1;
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return parts;
}

interface Props {
  message: ChatMessage;
  isMine: boolean;
  prev?: ChatMessage | null;
  onReply: () => void;
}

function isImage(url: string): boolean {
  return /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url);
}

function isContinuationOf(message: ChatMessage, prev: ChatMessage | null | undefined): boolean {
  if (!prev) return false;
  if (prev.autor_id !== message.autor_id) return false;
  const dt = new Date(message.created_at).getTime() - new Date(prev.created_at).getTime();
  return dt < 5 * 60 * 1000;
}

export function MessageBubble({ message, isMine, prev, onReply }: Props) {
  const continuation = isContinuationOf(message, prev);

  return (
    <div className={cn("group flex gap-2", isMine && "flex-row-reverse", continuation ? "mt-0.5" : "mt-2")}>
      {!isMine && !continuation && (
        <Avatar className="h-8 w-8 mt-1" title={message.autor?.nome ?? "—"}>
          {message.autor?.avatar_url ? (
            <AvatarImage src={message.autor.avatar_url} alt={message.autor.nome} />
          ) : null}
          <AvatarFallback className={cn("text-[10px] font-semibold", avatarBg(message.autor_id))}>
            {initials(message.autor?.nome)}
          </AvatarFallback>
        </Avatar>
      )}
      {!isMine && continuation && <div className="w-8 flex-shrink-0" />}

      <div className={cn("min-w-0 max-w-[78%]", isMine && "text-right")}>
        {!isMine && !continuation && (
          <div className={cn("mb-0.5 px-1 text-xs font-semibold", nameColor(message.autor_id))}>
            {message.autor?.nome ?? "—"}
          </div>
        )}

        {message.reply_to && (
          <div className="mb-1 rounded-md border-l-2 border-primary/50 bg-muted/30 px-2 py-1 text-left text-xs">
            <p className="font-medium text-muted-foreground">↳ {message.reply_to.autor_nome ?? "—"}</p>
            <p className="line-clamp-2 text-muted-foreground/80">{message.reply_to.conteudo}</p>
          </div>
        )}

        <div
          className={cn(
            "relative inline-block rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap text-left shadow-sm",
            isMine
              ? "bg-primary/20 border border-primary/30"
              : "bg-card border",
            !continuation && (isMine ? "rounded-tr-sm" : "rounded-tl-sm"),
          )}
        >
          <span className="pr-12">{renderConteudo(message.conteudo)}</span>
          <span className="ml-2 inline-flex items-baseline text-[10px] text-muted-foreground/80 align-bottom">
            {formatHourMinute(message.created_at)}
          </span>
        </div>

        {message.attachment_urls.length > 0 && (
          <div className={cn("flex flex-wrap gap-2 pt-1", isMine && "justify-end")}>
            {message.attachment_urls.map((url, i) => (
              <div key={i}>
                {isImage(url) ? (
                  <a href={url} target="_blank" rel="noopener noreferrer" className="block h-24 w-24 overflow-hidden rounded-md border bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="anexo" className="h-full w-full object-cover" />
                  </a>
                ) : (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2 py-1.5 text-xs hover:bg-muted"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>Arquivo</span>
                    <ExternalLink className="h-3 w-3 opacity-60" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onReply}
        className="self-start opacity-0 group-hover:opacity-100 transition-opacity rounded-md border bg-card p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Responder"
        title="Responder"
      >
        <Reply className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
