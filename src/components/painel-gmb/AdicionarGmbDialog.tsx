"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Sparkles } from "lucide-react";
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
import { updateClienteGmbAction } from "@/lib/clientes/gmb-actions";
import type { ClienteSemGmb } from "@/lib/painel-gmb/queries";

interface Props {
  clientesElegiveis: ClienteSemGmb[];
  placesApiEnabled: boolean;
}

/**
 * Botão + Dialog pra cadastrar GMB de um cliente direto do painel — sem
 * precisar navegar pra ficha individual de cada cliente. Yasmin pediu pra
 * facilitar quando o time vai cadastrar vários de uma vez.
 */
export function AdicionarGmbDialog({ clientesElegiveis, placesApiEnabled }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState<string>("");
  const [url, setUrl] = useState<string>("");
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!clientId) {
      toast.error("Selecione o cliente");
      return;
    }
    if (!url.trim()) {
      toast.error("Cole o link do Google Maps");
      return;
    }
    const formEl = e.currentTarget;
    startTransition(async () => {
      const fd = new FormData(formEl);
      const r = await updateClienteGmbAction(fd);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(
        r.autoFetched
          ? "GMB cadastrado — dados puxados automaticamente ✨"
          : "GMB cadastrado (modo manual)",
      );
      // Reset
      setClientId("");
      setUrl("");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={clientesElegiveis.length === 0}>
        <Plus className="mr-1.5 h-4 w-4" />
        Adicionar GMB
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar GMB ao painel</DialogTitle>
            <DialogDescription>
              Cole o link do Google Maps do cliente.
              {placesApiEnabled
                ? " Sistema busca nota e reviews automático via Google Places API."
                : " Modo manual ativo — você digita nota/reviews depois na ficha do cliente."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input type="hidden" name="client_id" value={clientId} />

            <div className="space-y-1.5">
              <Label>Cliente</Label>
              <SearchableSelect
                options={clientesElegiveis.map((c) => ({ value: c.id, label: c.nome }))}
                value={clientId || null}
                onChange={(v) => setClientId(v ?? "")}
                placeholder="Selecione o cliente"
                emptyText="Nenhum cliente elegível"
                disabled={pending}
              />
              <p className="text-[11px] text-muted-foreground">
                Lista filtrada: só clientes ativos sem GMB cadastrado.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gmb_link">Link do Google Maps</Label>
              <Input
                id="gmb_link"
                name="gmb_link"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://maps.app.goo.gl/..."
                disabled={pending}
              />
              <p className="text-[11px] text-muted-foreground">
                Google Maps → procure o cliente → Compartilhar → Copiar link.
              </p>
            </div>

            {placesApiEnabled && (
              <div className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-700 dark:text-emerald-300">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                <p>
                  Ao salvar, sistema busca nota e reviews automaticamente via
                  Google Places. Cron diário atualiza os dados sozinho daí em diante.
                </p>
              </div>
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
              <Button type="submit" disabled={pending || !clientId || !url.trim()}>
                {pending ? "Cadastrando..." : "Cadastrar GMB"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
