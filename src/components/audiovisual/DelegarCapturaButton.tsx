"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2, Clock, RotateCcw, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { delegateCapturaAction, markCapturaConcluidaAction, unmarkCapturaConcluidaAction } from "@/lib/audiovisual/actions";

interface Editor {
  id: string;
  nome: string;
}

interface Props {
  capturaId: string;
  /** Se já delegada, dados básicos pra mostrar status. Se null, mostra botão "Delegar". */
  delegated: { taskId: string; editorNome: string | null } | null;
  /** Se está marcada como concluída (timestamp). NULL se ainda em fluxo. */
  concluidaEm: string | null;
  /** Lista de editores ativos (passada do server). Vazia = botão fica desabled. */
  editores: Editor[];
  /** Se o user logado pode delegar (role check feito no server). */
  canDelegate: boolean;
}

export function DelegarCapturaButton({ capturaId, delegated, concluidaEm, editores, canDelegate }: Props) {
  const [open, setOpen] = useState(false);
  const [editorId, setEditorId] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const sortedEditores = useMemo(
    () => [...editores].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [editores],
  );

  function handleConcluir() {
    startTransition(async () => {
      const r = await markCapturaConcluidaAction(capturaId);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Captação marcada como concluída");
      router.refresh();
    });
  }

  function handleDesmarcar() {
    startTransition(async () => {
      const r = await unmarkCapturaConcluidaAction(capturaId);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Concluída desmarcada — voltou pro fluxo");
      router.refresh();
    });
  }

  // Se concluída manualmente, esse status tem prioridade visual
  if (concluidaEm) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-3 w-3" />
          Concluído
        </span>
        {delegated && (
          <Link href={`/tarefas/${delegated.taskId}`} className="text-xs text-muted-foreground hover:underline">
            (delegado a {delegated.editorNome ?? "—"})
          </Link>
        )}
        {canDelegate && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDesmarcar}
            disabled={pending}
            className="h-6 px-2 text-xs text-muted-foreground"
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            Desmarcar
          </Button>
        )}
      </div>
    );
  }

  // Se já delegada, mostra status + link pra task + botão "Concluir"
  if (delegated) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-700 dark:text-sky-400">
          <UserPlus className="h-3 w-3" />
          Delegado{delegated.editorNome ? ` a ${delegated.editorNome}` : ""}
        </span>
        <Link
          href={`/tarefas/${delegated.taskId}`}
          className="text-xs text-primary hover:underline"
        >
          ver tarefa →
        </Link>
        {canDelegate && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleConcluir}
            disabled={pending}
            className="h-6 px-2 text-xs text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400"
          >
            <Check className="mr-1 h-3 w-3" />
            Concluir
          </Button>
        )}
      </div>
    );
  }

  // Não delegada: mostra status pendente. Se canDelegate, mostra Delegar + Concluir.
  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
          <Clock className="h-3 w-3" />
          Pendente de delegação
        </span>
        {canDelegate && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(true)}
              disabled={pending}
              className="h-6 px-2 text-xs"
            >
              <UserPlus className="mr-1 h-3 w-3" />
              Delegar
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleConcluir}
              disabled={pending}
              className="h-6 px-2 text-xs text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400"
            >
              <Check className="mr-1 h-3 w-3" />
              Concluir
            </Button>
          </>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delegar pra editor</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="editor">Editor</Label>
              <select
                id="editor"
                value={editorId}
                onChange={(e) => setEditorId(e.target.value)}
                disabled={pending}
                className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
              >
                <option value="">— Selecione —</option>
                {sortedEditores.map((e) => (
                  <option key={e.id} value={e.id}>{e.nome}</option>
                ))}
              </select>
              {sortedEditores.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Nenhum editor ativo no sistema.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="due_date">Prazo</Label>
              <Input
                id="due_date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={pending}
              />
              <p className="text-xs text-muted-foreground">
                Deixar em branco = sem prazo.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!editorId) {
                  toast.error("Selecione um editor");
                  return;
                }
                const fd = new FormData();
                fd.set("captura_id", capturaId);
                fd.set("editor_id", editorId);
                if (dueDate) fd.set("due_date", dueDate);
                startTransition(async () => {
                  const r = await delegateCapturaAction(fd);
                  if (r.error) {
                    toast.error(r.error);
                    return;
                  }
                  toast.success("Captação delegada — tarefa criada");
                  setOpen(false);
                  setEditorId("");
                  setDueDate("");
                  router.refresh();
                });
              }}
              disabled={pending || !editorId}
            >
              {pending ? "Delegando…" : "Delegar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
