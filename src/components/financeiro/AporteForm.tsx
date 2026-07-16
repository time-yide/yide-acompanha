"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createAporteAction } from "@/lib/financeiro/aportes-actions";

interface SocioOption {
  id: string;
  nome: string;
}

interface Props {
  socios: SocioOption[];
}

const todayISO = () => new Date().toISOString().slice(0, 10);

export function AporteForm({ socios }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [formKey, setFormKey] = useState(0);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await createAporteAction(fd);
      if (r && "error" in r && r.error) {
        setError(r.error);
      } else {
        setFormKey((k) => k + 1); // reseta os campos
        router.refresh();
      }
    });
  }

  return (
    <form key={formKey} onSubmit={onSubmit} className="space-y-3 rounded-xl border bg-card p-4">
      <h3 className="text-sm font-semibold">Registrar aporte</h3>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Data</span>
          <input
            name="data"
            type="date"
            required
            defaultValue={todayISO()}
            className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Valor (R$)</span>
          <input
            name="valor"
            type="number"
            step="0.01"
            min="0.01"
            required
            className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm tabular-nums"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Sócio</span>
          <select
            name="socio_id"
            required
            defaultValue=""
            className="h-9 w-full rounded-md border bg-card px-2 text-sm"
          >
            <option value="" disabled>
              Selecione…
            </option>
            {socios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Tipo</span>
          <select
            name="tipo"
            required
            defaultValue="capital"
            className="h-9 w-full rounded-md border bg-card px-2 text-sm"
          >
            <option value="capital">Capital</option>
            <option value="emprestimo">Empréstimo</option>
          </select>
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">Descrição (opcional)</span>
        <textarea
          name="descricao"
          rows={2}
          className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm"
        />
      </label>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Salvando..." : "Registrar aporte"}
        </Button>
      </div>
    </form>
  );
}
