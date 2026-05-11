"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, RotateCcw, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { delegateCapturaAction, markCapturaConcluidaAction, unmarkCapturaConcluidaAction } from "@/lib/audiovisual/actions";
import { cn } from "@/lib/utils";

interface Editor {
  id: string;
  nome: string;
  /** Função do colaborador. Opcional pra retro-compat com chamadas antigas. */
  role?: string;
}

const ROLE_LABEL: Record<string, string> = {
  editor: "Editor",
  videomaker: "Videomaker",
  audiovisual_chefe: "Coord. audiovisual",
};

interface Props {
  capturaId: string;
  delegated: { taskId: string; editorNome: string | null } | null;
  concluidaEm: string | null;
  editores: Editor[];
  canDelegate: boolean;
}

/**
 * Badge minimalista: dot colorido + texto uppercase + cor de texto sutil.
 * Estilo Linear/Notion — comunica status sem o peso visual de um pill colorido.
 */
function StatusBadge({ tone, children }: { tone: "amber" | "sky" | "emerald"; children: React.ReactNode }) {
  const dotColor = {
    amber: "bg-amber-500",
    sky: "bg-sky-500",
    emerald: "bg-emerald-500",
  }[tone];
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
      <span className={cn("h-1.5 w-1.5 rounded-full", dotColor)} />
      {children}
    </span>
  );
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

  const renderActions = (children: React.ReactNode) => (
    <div className="flex items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );

  // Concluído: status verde + opcional referência ao delegado + botão desmarcar
  if (concluidaEm) {
    return renderActions(
      <>
        <StatusBadge tone="emerald">Concluído</StatusBadge>
        {delegated && (
          <Link
            href={`/tarefas/${delegated.taskId}`}
            className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
          >
            delegado a {delegated.editorNome ?? "—"}
          </Link>
        )}
        {canDelegate && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDesmarcar}
            disabled={pending}
            className="h-7 px-2 text-xs text-muted-foreground"
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            Desmarcar
          </Button>
        )}
      </>,
    );
  }

  // Delegado: status azul + link pra task + botão concluir
  if (delegated) {
    return renderActions(
      <>
        <StatusBadge tone="sky">
          Delegado{delegated.editorNome ? ` · ${delegated.editorNome}` : ""}
        </StatusBadge>
        <Link
          href={`/tarefas/${delegated.taskId}`}
          className="text-[11px] text-primary hover:underline"
        >
          ver tarefa
        </Link>
        {canDelegate && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleConcluir}
            disabled={pending}
            className="h-7 px-2 text-xs text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400"
          >
            <Check className="mr-1 h-3 w-3" />
            Concluir
          </Button>
        )}
      </>,
    );
  }

  // Pendente: status amarelo + botões delegar e concluir (se tem permissão)
  return (
    <>
      {renderActions(
        <>
          <StatusBadge tone="amber">Pendente</StatusBadge>
          {canDelegate && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen(true)}
                disabled={pending}
                className="h-7 px-2.5 text-xs"
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
                className="h-7 px-2 text-xs text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400"
              >
                <Check className="mr-1 h-3 w-3" />
                Concluir
              </Button>
            </>
          )}
        </>,
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delegar edição</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="editor">Responsável pela edição</Label>
              <select
                id="editor"
                value={editorId}
                onChange={(e) => setEditorId(e.target.value)}
                disabled={pending}
                className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
              >
                <option value="">— Selecione —</option>
                {sortedEditores.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}{e.role && ROLE_LABEL[e.role] ? ` — ${ROLE_LABEL[e.role]}` : ""}
                  </option>
                ))}
              </select>
              {sortedEditores.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Ninguém ativo pra receber edição (editor, videomaker ou coord. audiovisual).
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
