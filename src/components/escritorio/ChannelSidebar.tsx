"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Hash, MessageSquarePlus, Trash2, RotateCcw, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatRelativeChatTime } from "@/lib/escritorio/format-relative";
import { NovoDmModal } from "./NovoDmModal";
import type { ChannelWithUnread } from "@/lib/escritorio/types";
import { useRouter } from "next/navigation";
import { deleteDmAction } from "@/lib/escritorio/dm-actions";
import { deleteChannelAction, restoreChannelAction, type DeletedChannel } from "@/lib/escritorio/channel-actions";

function initials(nome: string | undefined | null): string {
  if (!nome) return "";
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
  viewerRole: string;
  deletedChannels: DeletedChannel[];
}

export function ChannelSidebar({ channels, currentKind, currentChannelId, pessoas, viewerId, viewerRole, deletedChannels }: Props) {
  const [novoOpen, setNovoOpen] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onDeleteDm(channelId: string, nome: string) {
    if (!confirm(`Apagar a conversa com ${nome} pra vocês dois? Não dá pra desfazer.`)) return;
    startTransition(async () => {
      const r = await deleteDmAction(channelId);
      if (r?.error) { alert(r.error); return; }
      if (currentChannelId === channelId) router.push("/escritorio");
      else router.refresh();
    });
  }

  function onDeleteChannel(channelId: string, kind: string, nome: string) {
    if (!confirm(`Excluir o canal ${nome}? Dá pra restaurar depois.`)) return;
    startTransition(async () => {
      const r = await deleteChannelAction(channelId);
      if (r?.error) { alert(r.error); return; }
      if (currentKind === kind) router.push("/escritorio");
      else router.refresh();
    });
  }

  function onRestore(channelId: string) {
    startTransition(async () => {
      const r = await restoreChannelAction(channelId);
      if (r?.error) { alert(r.error); return; }
      router.refresh();
    });
  }

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
            // Pra DM, foto é a do outro membro. Pra grupo, é a icon_url
            // setada pelo admin (ou null → fallback no Hash).
            const avatarSrc = isDm ? c.dm_other?.avatar_url ?? null : c.icon_url;
            const active = isDm
              ? c.id === currentChannelId
              : c.kind === currentKind;
            const href = isDm ? `/escritorio/dm/${c.id}` : `/escritorio/${c.kind}`;

            const preview = c.last_message;
            const previewText = preview
              ? `${preview.autor_id === viewerId ? "Você: " : ""}${preview.conteudo}`
              : null;

            const canDel = isDm
              ? (c.dm_other != null || viewerRole === "socio" || viewerRole === "adm")
              : viewerRole === "socio";

            return (
              <div key={c.id} className="group relative">
                <Link
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
                {canDel && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      isDm
                        ? onDeleteDm(c.id, displayName)
                        : onDeleteChannel(c.id, c.kind, c.nome)
                    }
                    className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive group-hover:block"
                    aria-label={isDm ? "Excluir conversa" : "Excluir canal"}
                    title={isDm ? "Excluir conversa" : "Excluir canal"}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {viewerRole === "socio" && deletedChannels.length > 0 && (
        <div className="border-t px-2 py-1">
          <button
            type="button"
            onClick={() => setShowDeleted((v) => !v)}
            className="flex w-full items-center gap-1 rounded px-1 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
            aria-expanded={showDeleted}
          >
            <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", showDeleted && "rotate-90")} />
            Canais excluídos ({deletedChannels.length})
          </button>
          {showDeleted && (
            <ul className="space-y-0.5 pb-1">
              {deletedChannels.map((dc) => (
                <li key={dc.id} className="flex items-center justify-between gap-2 rounded px-2 py-1 text-sm">
                  <span className="truncate text-muted-foreground">{dc.nome}</span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => onRestore(dc.id)}
                    className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-primary hover:bg-primary/10"
                    title="Restaurar canal"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Restaurar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <NovoDmModal open={novoOpen} onOpenChange={setNovoOpen} pessoas={pessoas} />
    </aside>
  );
}
