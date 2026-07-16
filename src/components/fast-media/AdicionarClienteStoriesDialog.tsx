"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
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
import { SearchableSelect } from "@/components/ui/searchable-select";
import { addClienteStoriesAction } from "@/lib/painel/stories-actions";
import type { ClienteElegivelStories } from "@/lib/painel/stories-queries";

interface Props {
  clientesElegiveis: ClienteElegivelStories[];
}

/**
 * Botão + Dialog pra adicionar um cliente da carteira à grade de stories,
 * definindo a quantidade diária — direto do /fast-media, sem ir na ficha.
 */
export function AdicionarClienteStoriesDialog({ clientesElegiveis }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState<string>("");
  const [diaria, setDiaria] = useState<string>("1");
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!clientId) {
      toast.error("Selecione o cliente");
      return;
    }
    const n = Number(diaria);
    if (!Number.isInteger(n) || n < 1 || n > 99) {
      toast.error("Quantidade diária deve ser de 1 a 99");
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set("client_id", clientId);
      fd.set("quantidade_diaria", String(n));
      const r = await addClienteStoriesAction(fd);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Cliente adicionado à grade de stories");
      setClientId("");
      setDiaria("1");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-1.5 h-4 w-4" />
        Adicionar cliente
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar cliente à grade de stories</DialogTitle>
            <DialogDescription>
              Escolha um cliente da carteira e defina quantos stories por dia.
            </DialogDescription>
          </DialogHeader>

          {clientesElegiveis.length === 0 ? (
            <div className="space-y-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
              <p className="font-medium text-amber-700 dark:text-amber-300">
                Nenhum cliente elegível pra adicionar agora.
              </p>
              <p className="text-xs text-muted-foreground">
                Todos os clientes ativos desta unidade já estão na grade de stories.
              </p>
              <DialogFooter>
                <Button type="button" onClick={() => setOpen(false)}>
                  Fechar
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Cliente</Label>
                <SearchableSelect
                  options={clientesElegiveis.map((c) => ({ value: c.id, label: c.nome }))}
                  value={clientId || null}
                  onChange={(v) => setClientId(v ?? "")}
                  placeholder="Selecione o cliente"
                  emptyText="Nenhum cliente encontrado"
                  disabled={pending}
                />
                <p className="text-[11px] text-muted-foreground">
                  Lista filtrada: só clientes ativos que ainda não estão na grade.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="diaria">Stories por dia</Label>
                <Input
                  id="diaria"
                  type="number"
                  min={1}
                  max={99}
                  step={1}
                  value={diaria}
                  onChange={(e) => setDiaria(e.target.value)}
                  disabled={pending}
                />
                <p className="text-[11px] text-muted-foreground">
                  A meta do mês vira este número × dias do mês.
                </p>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={pending || !clientId}>
                  {pending ? "Adicionando..." : "Adicionar"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
