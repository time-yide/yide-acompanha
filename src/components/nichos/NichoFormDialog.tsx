"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X } from "lucide-react";
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
import { DatasComemoTable } from "./DatasComemoTable";
import { createNichoAction, updateNichoAction } from "@/lib/nichos/actions";
import type { NichoRow, DataComemorativa } from "@/lib/nichos/schema";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nicho?: NichoRow | null;
}

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function NichoFormDialog({ open, onOpenChange, nicho }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [nome, setNome] = useState(nicho?.nome ?? "");
  const [slug, setSlug] = useState(nicho?.slug ?? "");
  const [slugManual, setSlugManual] = useState(false);
  const [datas, setDatas] = useState<DataComemorativa[]>(
    nicho?.datas_comemorativas ?? []
  );
  const [palavras, setPalavras] = useState<string[]>(
    nicho?.palavras_chave ?? []
  );
  const [palavraInput, setPalavraInput] = useState("");

  const isEdit = !!nicho;

  function handleNomeChange(val: string) {
    setNome(val);
    if (!slugManual) {
      setSlug(slugify(val));
    }
  }

  function addPalavra() {
    const trimmed = palavraInput.trim();
    if (trimmed && !palavras.includes(trimmed)) {
      setPalavras([...palavras, trimmed]);
    }
    setPalavraInput("");
  }

  function removePalavra(idx: number) {
    setPalavras(palavras.filter((_, i) => i !== idx));
  }

  function handlePalavraKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addPalavra();
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const fd = new FormData();
      if (isEdit) fd.set("id", nicho.id);
      fd.set("nome", nome);
      fd.set("slug", slug);
      fd.set("datas_comemorativas", JSON.stringify(datas));
      fd.set("palavras_chave", JSON.stringify(palavras));

      const action = isEdit ? updateNichoAction : createNichoAction;
      const result = await action(fd);

      if (!result.success) {
        toast.error(result.error ?? "Erro ao salvar nicho");
        return;
      }

      toast.success(isEdit ? "Nicho atualizado" : "Nicho criado");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar nicho" : "Novo nicho"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nicho-nome">Nome</Label>
            <Input
              id="nicho-nome"
              value={nome}
              onChange={(e) => handleNomeChange(e.target.value)}
              required
              minLength={1}
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nicho-slug">Slug</Label>
            <Input
              id="nicho-slug"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugManual(true);
              }}
              required
              pattern="^[a-z0-9-]+$"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Gerado automaticamente a partir do nome.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Datas comemorativas</Label>
            <DatasComemoTable value={datas} onChange={setDatas} />
          </div>

          <div className="space-y-2">
            <Label>Palavras-chave</Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {palavras.map((p, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs"
                >
                  {p}
                  <button
                    type="button"
                    onClick={() => removePalavra(idx)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={palavraInput}
                onChange={(e) => setPalavraInput(e.target.value)}
                onKeyDown={handlePalavraKeyDown}
                placeholder="Digite e pressione Enter"
                className="h-8 text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addPalavra}
              >
                Adicionar
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : isEdit ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
