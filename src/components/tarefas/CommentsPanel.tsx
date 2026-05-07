"use client";

import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { addCommentAction } from "@/lib/tarefas/actions";
import type { TaskComment } from "@/lib/tarefas/queries";

interface Props {
  taskId: string;
  initialComments: TaskComment[];
  canComment: boolean;
  currentUserId: string;
}

function initials(nome: string | undefined | null): string {
  if (!nome) return "—";
  const parts = nome.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function avatarBg(userId: string | undefined | null): string {
  const palette = [
    "bg-emerald-500/30 text-emerald-700 dark:text-emerald-300",
    "bg-sky-500/30 text-sky-700 dark:text-sky-300",
    "bg-amber-500/30 text-amber-700 dark:text-amber-300",
    "bg-rose-500/30 text-rose-700 dark:text-rose-300",
    "bg-violet-500/30 text-violet-700 dark:text-violet-300",
    "bg-teal-500/30 text-teal-700 dark:text-teal-300",
    "bg-orange-500/30 text-orange-700 dark:text-orange-300",
    "bg-pink-500/30 text-pink-700 dark:text-pink-300",
  ];
  if (!userId) return palette[0];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

function formatDateTimeBR(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${date} às ${time}`;
}

export function CommentsPanel({ taskId, initialComments, canComment, currentUserId }: Props) {
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const content = draft.trim();
    if (content.length === 0) return;

    startTransition(async () => {
      const fd = new FormData();
      fd.set("task_id", taskId);
      fd.set("conteudo", content);
      const r = await addCommentAction(fd);
      if (r?.error) {
        setError(r.error);
        toast.error(r.error);
        return;
      }
      setDraft("");
      toast.success("Comentário publicado");
    });
  }

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h3 className="text-sm font-semibold">Comentários</h3>
        <p className="text-xs text-muted-foreground">Conversa geral da demanda — visível pra todos os envolvidos.</p>
      </div>

      <div className="space-y-3">
        {initialComments.length === 0 ? (
          <p className="text-xs italic text-muted-foreground">Nenhum comentário ainda.</p>
        ) : (
          initialComments.map((c) => {
            const isMine = c.autor_id === currentUserId;
            return (
              <div key={c.id} className={isMine ? "flex gap-2.5 flex-row-reverse" : "flex gap-2.5"}>
                <Avatar className="h-7 w-7" title={c.autor?.nome ?? "—"}>
                  {c.autor?.avatar_url ? (
                    <AvatarImage src={c.autor.avatar_url} alt={c.autor.nome} />
                  ) : null}
                  <AvatarFallback className={`text-[10px] font-semibold ${avatarBg(c.autor_id)}`}>
                    {initials(c.autor?.nome)}
                  </AvatarFallback>
                </Avatar>
                <div className={isMine ? "max-w-[80%] space-y-0.5 text-right" : "max-w-[80%] space-y-0.5"}>
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground">{c.autor?.nome ?? "—"}</span>
                    <span>{formatDateTimeBR(c.criado_em)}</span>
                  </div>
                  <div
                    className={
                      isMine
                        ? "rounded-lg rounded-tr-sm border border-primary/30 bg-primary/10 px-3 py-2 text-sm whitespace-pre-wrap text-left"
                        : "rounded-lg rounded-tl-sm border bg-muted/40 px-3 py-2 text-sm whitespace-pre-wrap"
                    }
                  >
                    {c.conteudo}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {canComment ? (
        <form onSubmit={handleSubmit} className="space-y-2 border-t pt-3">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Escreva um comentário..."
            rows={3}
            maxLength={2000}
            disabled={pending}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-muted-foreground">{draft.length}/2000</span>
            <Button type="submit" size="sm" disabled={pending || draft.trim().length === 0}>
              <Send className="h-3.5 w-3.5 mr-1.5" />
              {pending ? "Enviando..." : "Enviar"}
            </Button>
          </div>
        </form>
      ) : (
        <p className="border-t pt-3 text-xs text-muted-foreground">Você não tem permissão pra comentar nessa tarefa.</p>
      )}
    </Card>
  );
}
