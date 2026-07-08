"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { criarAnuncioAction } from "@/lib/ecommerce/actions";
import { MARKETPLACES, MARKETPLACE_LABELS } from "@/lib/ecommerce/marketplaces";

interface Props {
  clientes: { id: string; nome: string }[];
}

export function NovoAnuncioButton({ clientes }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(formData: FormData) {
    setError(null);
    start(async () => {
      const r = await criarAnuncioAction(formData);
      if ("error" in r) { setError(r.error); return; }
      setOpen(false);
      router.refresh();
    });
  }

  const semClientes = clientes.length === 0;

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} disabled={semClientes}>
        <Plus className="h-4 w-4" /> Novo lançamento
      </Button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <form
            action={submit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md space-y-3 rounded-xl border bg-card p-5"
          >
            <h2 className="font-semibold">Novo lançamento de anúncios</h2>

            <div className="space-y-1.5">
              <Label htmlFor="client_id">Cliente (e-commerce)</Label>
              <select
                id="client_id"
                name="client_id"
                required
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">Selecione…</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="quantidade">Quantidade</Label>
                <Input
                  id="quantidade"
                  name="quantidade"
                  type="number"
                  min={1}
                  required
                  defaultValue={1}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="data">Data</Label>
                <Input
                  id="data"
                  name="data"
                  type="date"
                  required
                  defaultValue={new Date().toISOString().slice(0, 10)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="marketplace">Marketplace</Label>
              <select
                id="marketplace"
                name="marketplace"
                required
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                {MARKETPLACES.map((m) => (
                  <option key={m} value={m}>{MARKETPLACE_LABELS[m]}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="observacao">Observação (opcional)</Label>
              <Textarea id="observacao" name="observacao" rows={2} maxLength={2000} />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
