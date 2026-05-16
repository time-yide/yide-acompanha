"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { createUnitAction, updateUnitAction } from "@/lib/units/actions";
import type { Unit } from "@/lib/units/schema";

interface Props {
  /** Quando passado, é edição. Sem isso, é criação. */
  unit?: Unit | null;
  trigger?: React.ReactNode;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function UnitFormDialog({ unit, trigger }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const isEdit = !!unit;

  const [nome, setNome] = useState(unit?.nome ?? "");
  const [slug, setSlug] = useState(unit?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(false);
  const [endereco, setEndereco] = useState(unit?.endereco ?? "");
  const [cnpj, setCnpj] = useState(unit?.cnpj ?? "");
  const [corDestaque, setCorDestaque] = useState(unit?.cor_destaque ?? "#10b981");
  const [ativa, setAtiva] = useState(unit?.ativa ?? true);

  function handleNomeChange(value: string) {
    setNome(value);
    if (!slugTouched && !isEdit) {
      setSlug(slugify(value));
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!nome.trim() || !slug.trim()) {
      toast.error("Nome e slug são obrigatórios");
      return;
    }
    const fd = new FormData();
    if (isEdit) fd.set("id", unit.id);
    fd.set("nome", nome);
    fd.set("slug", slug);
    fd.set("endereco", endereco);
    fd.set("cnpj", cnpj);
    fd.set("cor_destaque", corDestaque);
    fd.set("ativa", String(ativa));

    startTransition(async () => {
      const r = isEdit
        ? await updateUnitAction(fd)
        : await createUnitAction(fd);
      if (!r.ok) {
        toast.error(r.error ?? "Erro");
        return;
      }
      toast.success(isEdit ? "Unidade atualizada" : "Unidade criada");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : (
        <Button onClick={() => setOpen(true)} size={isEdit ? "sm" : "default"} variant={isEdit ? "outline" : "default"}>
          {isEdit ? <Pencil className="mr-1.5 h-3.5 w-3.5" /> : <Plus className="mr-1.5 h-4 w-4" />}
          {isEdit ? "Editar" : "Nova unidade"}
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Editar unidade" : "Nova unidade"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Atualize as informações da unidade."
                : "Crie uma nova unidade/filial pro sistema multi-tenant."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => handleNomeChange(e.target.value)}
                placeholder="Ex: Filial Salvador"
                disabled={pending}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="slug">Slug *</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => {
                  setSlug(slugify(e.target.value));
                  setSlugTouched(true);
                }}
                placeholder="ex: salvador"
                disabled={pending}
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Identificador url-safe — minúsculas, números e hífen.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input
                  id="cnpj"
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  disabled={pending}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cor">Cor destaque</Label>
                <Input
                  id="cor"
                  type="color"
                  value={corDestaque}
                  onChange={(e) => setCorDestaque(e.target.value)}
                  disabled={pending}
                  className="h-9 w-full p-1"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="endereco">Endereço</Label>
              <Input
                id="endereco"
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                placeholder="Cidade — UF"
                disabled={pending}
              />
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label htmlFor="ativa" className="text-sm">
                  Unidade ativa
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Inativa não aparece no seletor.
                </p>
              </div>
              <Switch id="ativa" checked={ativa} onCheckedChange={setAtiva} disabled={pending} />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Salvando..." : isEdit ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
