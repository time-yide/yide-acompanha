"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { redelegarCapturaAction } from "@/lib/audiovisual/actions";

interface Editor {
  id: string;
  nome: string;
  role?: string;
}

const ROLE_LABEL: Record<string, string> = {
  editor: "Editor",
  videomaker: "Videomaker",
  audiovisual_chefe: "Coord. audiovisual",
  fast_midia: "Fast Mídia",
};

interface Props {
  capturaId: string;
  editorAtualId: string;
  editores: Editor[];
}

export function TrocarEditorButton({ capturaId, editorAtualId, editores }: Props) {
  const [open, setOpen] = useState(false);
  const [editorId, setEditorId] = useState<string>("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const sortedEditores = useMemo(
    () => [...editores].filter((e) => e.id !== editorAtualId).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [editores, editorAtualId],
  );

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowRightLeft className="mr-1 h-3 w-3" />
        Trocar
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Trocar editor</DialogTitle>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="novo_editor">Novo responsável pela edição</Label>
            <select
              id="novo_editor"
              value={editorId}
              onChange={(e) => setEditorId(e.target.value)}
              disabled={pending}
              className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
            >
              <option value="">Selecione</option>
              {sortedEditores.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}{e.role && ROLE_LABEL[e.role] ? ` · ${ROLE_LABEL[e.role]}` : ""}
                </option>
              ))}
            </select>
            {sortedEditores.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Nenhum outro editor ativo disponível.
              </p>
            )}
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
                startTransition(async () => {
                  const r = await redelegarCapturaAction(fd);
                  if (r.error) {
                    toast.error(r.error);
                    return;
                  }
                  toast.success("Editor trocado");
                  setOpen(false);
                  setEditorId("");
                  router.refresh();
                });
              }}
              disabled={pending || !editorId}
            >
              {pending ? "Trocando…" : "Trocar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
