"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createCursoExternoAction,
  updateCursoExternoAction,
} from "@/lib/cursos-externos/actions";
import {
  PLATAFORMAS_SUGERIDAS,
  type CursoExternoRow,
} from "@/lib/cursos-externos/schema";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Quando passado, é edição. Sem isso é criação. */
  curso?: CursoExternoRow;
}

export function CursoOnlineFormDialog({ open, onOpenChange, curso }: Props) {
  const router = useRouter();
  const isEdit = !!curso;
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    startTransition(async () => {
      const fd = new FormData(formEl);
      const r = isEdit
        ? await updateCursoExternoAction(fd)
        : await createCursoExternoAction(fd);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(isEdit ? "Curso atualizado" : "Curso cadastrado");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar curso online" : "Novo curso online"}
          </DialogTitle>
          <DialogDescription>
            Cadastro de acesso a cursos externos (Hotmart, Udemy, etc.) compartilhado pra equipe.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {isEdit && curso && <input type="hidden" name="id" value={curso.id} />}

          <div className="space-y-1.5">
            <Label htmlFor="nome">Nome do curso *</Label>
            <Input
              id="nome"
              name="nome"
              defaultValue={curso?.nome}
              required
              maxLength={200}
              placeholder="Ex: Marketing Digital - Erico Rocha"
              disabled={pending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="plataforma">Plataforma *</Label>
            <Input
              id="plataforma"
              name="plataforma"
              defaultValue={curso?.plataforma}
              required
              maxLength={100}
              list="plataformas-list"
              placeholder="Hotmart, Udemy, etc."
              disabled={pending}
            />
            <datalist id="plataformas-list">
              {PLATAFORMAS_SUGERIDAS.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="link">Link de acesso</Label>
            <Input
              id="link"
              name="link"
              type="url"
              defaultValue={curso?.link ?? ""}
              placeholder="https://..."
              disabled={pending}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="email_acesso">Email / login</Label>
              <Input
                id="email_acesso"
                name="email_acesso"
                defaultValue={curso?.email_acesso ?? ""}
                placeholder="time@yideequipe.com"
                maxLength={200}
                disabled={pending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="senha_acesso">Senha</Label>
              <Input
                id="senha_acesso"
                name="senha_acesso"
                defaultValue={curso?.senha_acesso ?? ""}
                placeholder="senha compartilhada"
                maxLength={200}
                disabled={pending}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="descricao">Descrição (opcional)</Label>
            <Textarea
              id="descricao"
              name="descricao"
              defaultValue={curso?.descricao ?? ""}
              rows={3}
              maxLength={2000}
              placeholder="Sobre o que é, módulos importantes, etc."
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
                  : "Cadastrar curso"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
