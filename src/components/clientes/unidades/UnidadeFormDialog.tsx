"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createUnidadeAction,
  updateUnidadeAction,
} from "@/lib/clientes/unidades/actions";
import type { ClientUnitRow } from "@/lib/clientes/unidades/schema";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  /** Quando presente é edição; ausente é criação. */
  unidade?: ClientUnitRow;
}

export function UnidadeFormDialog({ open, onOpenChange, clientId, unidade }: Props) {
  const router = useRouter();
  const isEdit = !!unidade;
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    startTransition(async () => {
      const fd = new FormData(formEl);
      const r = isEdit
        ? await updateUnidadeAction(fd)
        : await createUnidadeAction(fd);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(isEdit ? "Unidade atualizada" : "Unidade cadastrada");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar unidade" : "Nova unidade"}</DialogTitle>
          <DialogDescription>
            Cadastro de filial/loja/restaurante do cliente. Aparece no portal pra ele ver.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {isEdit && unidade && <input type="hidden" name="id" value={unidade.id} />}
          {!isEdit && <input type="hidden" name="client_id" value={clientId} />}

          <div className="space-y-1.5">
            <Label htmlFor="nome">Nome da unidade *</Label>
            <Input
              id="nome"
              name="nome"
              defaultValue={unidade?.nome}
              required
              maxLength={200}
              placeholder="Ex: Gallo - Unidade Cuiabá Centro"
              disabled={pending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="endereco">Endereço</Label>
            <Input
              id="endereco"
              name="endereco"
              defaultValue={unidade?.endereco ?? ""}
              placeholder="Rua, número, bairro, cidade"
              maxLength={500}
              disabled={pending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="drive_url">Link do Drive da unidade (opcional)</Label>
            <Input
              id="drive_url"
              name="drive_url"
              type="url"
              defaultValue={unidade?.drive_url ?? ""}
              placeholder="https://drive.google.com/..."
              disabled={pending}
            />
            <p className="text-[11px] text-muted-foreground">
              Subpasta no Drive específica dessa unidade. Cliente acessa direto pelo portal.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              name="observacoes"
              defaultValue={unidade?.observacoes ?? ""}
              rows={2}
              maxLength={2000}
              placeholder="Notas internas (não aparece pro cliente)"
              disabled={pending}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending
                ? "Salvando…"
                : isEdit
                  ? "Salvar alterações"
                  : "Cadastrar unidade"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
