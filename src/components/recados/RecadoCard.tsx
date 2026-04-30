"use client";

import { useState, useTransition } from "react";
import { MoreHorizontal, Pencil, Trash2, Pin, PinOff, Archive, ArchiveRestore } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { PriorityBadge } from "./PriorityBadge";
import { EmojiReactionPicker } from "./EmojiReactionPicker";
import { NovoRecadoDialog } from "./NovoRecadoDialog";
import {
  apagarRecadoAction,
  arquivarRecadoAction,
  fixarRecadoAction,
  reagirRecadoAction,
} from "@/lib/recados/actions";
import type { RecadoRow } from "@/lib/recados/queries";
import { cn } from "@/lib/utils";

interface Props {
  recado: RecadoRow;
  currentUserId: string;
  currentUserRole: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

function initials(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function aggregateReacoes(reacoes: RecadoRow["reacoes"], userId: string) {
  const counts = new Map<string, { count: number; iReacted: boolean }>();
  for (const r of reacoes) {
    const cur = counts.get(r.emoji) ?? { count: 0, iReacted: false };
    cur.count++;
    if (r.user_id === userId) cur.iReacted = true;
    counts.set(r.emoji, cur);
  }
  return [...counts.entries()].map(([emoji, v]) => ({ emoji, ...v }));
}

export function RecadoCard({ recado, currentUserId, currentUserRole }: Props) {
  const isAuthor = recado.autor_id === currentUserId;
  const isPrivileged = currentUserRole === "socio" || currentUserRole === "adm";
  const canEdit = isAuthor || isPrivileged;
  const canPin = currentUserRole === "socio";

  const [editOpen, setEditOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const reacoes = aggregateReacoes(recado.reacoes, currentUserId);

  function onAction(fn: () => Promise<unknown>) {
    startTransition(async () => {
      await fn();
    });
  }

  return (
    <>
      <Card id={recado.id} className="space-y-3 p-4">
        <header className="flex items-start gap-3">
          <Avatar className="h-9 w-9">
            {recado.autor?.avatar_url ? <AvatarImage src={recado.autor.avatar_url} alt={recado.autor.nome} /> : null}
            <AvatarFallback>{initials(recado.autor?.nome ?? "??")}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">{recado.autor?.nome ?? "Usuário removido"}</span>
              <PriorityBadge role={recado.autor_role_snapshot} />
              {recado.permanente && (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Pin className="h-3 w-3" /> Fixado
                </span>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground" title={new Date(recado.criado_em).toLocaleString("pt-BR")}>
              {timeAgo(recado.criado_em)}
            </div>
          </div>
          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Ações"
              >
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditOpen(true)} disabled={pending}>
                  <Pencil className="mr-2 h-4 w-4" /> Editar
                </DropdownMenuItem>
                {!recado.arquivado && (
                  <DropdownMenuItem onClick={() => onAction(() => arquivarRecadoAction(recado.id, true))} disabled={pending}>
                    <Archive className="mr-2 h-4 w-4" /> Arquivar
                  </DropdownMenuItem>
                )}
                {recado.arquivado && (
                  <DropdownMenuItem onClick={() => onAction(() => arquivarRecadoAction(recado.id, false))} disabled={pending}>
                    <ArchiveRestore className="mr-2 h-4 w-4" /> Desarquivar
                  </DropdownMenuItem>
                )}
                {canPin && !recado.permanente && (
                  <DropdownMenuItem onClick={() => onAction(() => fixarRecadoAction(recado.id, true))} disabled={pending}>
                    <Pin className="mr-2 h-4 w-4" /> Fixar
                  </DropdownMenuItem>
                )}
                {canPin && recado.permanente && (
                  <DropdownMenuItem onClick={() => onAction(() => fixarRecadoAction(recado.id, false))} disabled={pending}>
                    <PinOff className="mr-2 h-4 w-4" /> Desafixar
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => {
                    if (confirm("Apagar esse recado? Essa ação não pode ser desfeita.")) {
                      onAction(() => apagarRecadoAction(recado.id));
                    }
                  }}
                  disabled={pending}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Apagar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </header>

        <div className="space-y-1">
          <div className="font-semibold">{recado.titulo}</div>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{recado.corpo}</p>
        </div>

        <footer className="flex flex-wrap items-center gap-1.5">
          {reacoes.map((r) => (
            <button
              key={r.emoji}
              type="button"
              disabled={pending}
              onClick={() => onAction(() => reagirRecadoAction(recado.id, r.emoji))}
              className={cn(
                "inline-flex h-7 items-center gap-1 rounded-full border px-2 text-xs transition",
                r.iReacted ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground",
              )}
            >
              <span className="leading-none">{r.emoji}</span>
              <span>{r.count}</span>
            </button>
          ))}
          <EmojiReactionPicker recadoId={recado.id} />
        </footer>
      </Card>

      {editOpen && (
        <NovoRecadoDialog
          mode="edit"
          recado={{ id: recado.id, titulo: recado.titulo, corpo: recado.corpo }}
          currentUserRole={currentUserRole}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
    </>
  );
}
