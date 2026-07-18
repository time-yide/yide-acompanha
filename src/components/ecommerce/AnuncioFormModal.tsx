"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MARKETPLACES, MARKETPLACE_LABELS } from "@/lib/ecommerce/marketplaces";

export interface AnuncioInitial {
  id?: string;
  client_id?: string;
  data?: string; // YYYY-MM-DD
  quantidade?: number;
  marketplace?: string;
  observacao?: string | null;
}

interface Props {
  clientes: { id: string; nome: string }[];
  titulo: string;
  initial?: AnuncioInitial;
  action: (fd: FormData) => Promise<{ success: true } | { error: string }>;
  onClose: () => void;
  onDone: () => void;
}

export function AnuncioFormModal({ clientes, titulo, initial, action, onClose, onDone }: Props) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const hoje = new Date().toISOString().slice(0, 10);

  function submit(formData: FormData) {
    setError(null);
    start(async () => {
      const r = await action(formData);
      if ("error" in r) { setError(r.error); return; }
      onDone();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <form
        action={submit}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="anuncio-form-titulo"
        className="w-full max-w-md space-y-3 rounded-xl border bg-card p-5"
      >
        <h2 id="anuncio-form-titulo" className="font-semibold">{titulo}</h2>
        {initial?.id && <input type="hidden" name="id" value={initial.id} />}

        <div className="space-y-1.5">
          <Label htmlFor="client_id">Cliente (e-commerce)</Label>
          <select
            id="client_id"
            name="client_id"
            required
            defaultValue={initial?.client_id ?? ""}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">Selecione…</option>
            {clientes.map((c) => (<option key={c.id} value={c.id}>{c.nome}</option>))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="quantidade">Quantidade</Label>
            <Input id="quantidade" name="quantidade" type="number" min={1} required defaultValue={initial?.quantidade ?? 1} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="data">Data</Label>
            <Input id="data" name="data" type="date" required defaultValue={initial?.data ?? hoje} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="marketplace">Marketplace</Label>
          <select
            id="marketplace"
            name="marketplace"
            required
            defaultValue={initial?.marketplace ?? MARKETPLACES[0]}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            {MARKETPLACES.map((m) => (<option key={m} value={m}>{MARKETPLACE_LABELS[m]}</option>))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="observacao">Observação (opcional)</Label>
          <Textarea id="observacao" name="observacao" rows={2} maxLength={2000} defaultValue={initial?.observacao ?? ""} />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar"}</Button>
        </div>
      </form>
    </div>
  );
}
