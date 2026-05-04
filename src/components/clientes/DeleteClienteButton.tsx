"use client";

import { useState, useTransition } from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { deleteClienteAction } from "@/lib/clientes/actions";

interface Props {
  clienteId: string;
  clienteNome: string;
}

export function DeleteClienteButton({ clienteId, clienteNome }: Props) {
  const [open, setOpen] = useState(false);
  const [confirmacao, setConfirmacao] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setConfirmacao("");
    setJustificativa("");
    setError(null);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const fd = new FormData();
    fd.set("id", clienteId);
    fd.set("confirmacao_nome", confirmacao);
    fd.set("justificativa", justificativa);

    startTransition(async () => {
      const r = await deleteClienteAction(fd);
      if (r && "error" in r && r.error) {
        setError(r.error);
        return;
      }
      // Sucesso: redirect já aconteceu no server
    });
  }

  const nomeBate =
    confirmacao.trim().toLowerCase() === clienteNome.trim().toLowerCase();

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="mr-1 h-4 w-4" />
        Excluir
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!pending) setOpen(o);
        }}
      >
        <DialogContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Excluir cliente permanentemente
              </DialogTitle>
            </DialogHeader>

            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <p className="font-semibold text-destructive">
                Esta ação não pode ser desfeita.
              </p>
              <p className="mt-1 text-muted-foreground">
                Vai remover o cliente <strong>{clienteNome}</strong> e todo o
                histórico relacionado: checklists mensais, avaliações de
                satisfação, briefings, arquivos, notas e datas. Tarefas e
                eventos de calendário ficam, mas perdem o vínculo com este
                cliente.
              </p>
              <p className="mt-2 text-muted-foreground">
                Se quiser apenas marcar como ex-cliente preservando histórico,
                use <strong>Marcar churn</strong> em vez disso.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmacao_nome">
                Para confirmar, digite o nome do cliente:{" "}
                <span className="font-mono text-foreground">{clienteNome}</span>
              </Label>
              <Input
                id="confirmacao_nome"
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
                placeholder={clienteNome}
                autoComplete="off"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="justificativa">
                Motivo da exclusão (vai pro audit log)
              </Label>
              <Textarea
                id="justificativa"
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                rows={3}
                placeholder="Ex.: cadastro duplicado, criado por engano em teste"
                required
                minLength={3}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={pending || !nomeBate || justificativa.trim().length < 3}
              >
                {pending ? "Excluindo..." : "Excluir permanentemente"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
