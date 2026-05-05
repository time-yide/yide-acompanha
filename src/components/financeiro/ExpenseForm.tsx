"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createExpenseAction, updateExpenseAction } from "@/lib/financeiro/actions";
import { EXPENSE_CATEGORIAS, CATEGORIA_LABEL, type ExpenseCategoria, type ExpenseTipo } from "@/lib/financeiro/schema";

interface Props {
  defaults?: {
    id?: string;
    descricao: string;
    categoria: ExpenseCategoria;
    tipo: ExpenseTipo;
    valor: number;
    mes_referencia: string | null;
    inicio_mes: string | null;
    fim_mes: string | null;
    notas: string | null;
  };
  onClose: () => void;
}

const monthNow = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export function ExpenseForm({ defaults, onClose }: Props) {
  const router = useRouter();
  const isEdit = !!defaults?.id;
  const [tipo, setTipo] = useState<ExpenseTipo>(defaults?.tipo ?? "fixa");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    if (defaults?.id) fd.set("id", defaults.id);
    startTransition(async () => {
      const r = isEdit
        ? await updateExpenseAction(fd)
        : await createExpenseAction(fd);
      if (r && "error" in r && r.error) setError(r.error);
      else { onClose(); router.refresh(); }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="text-xs text-muted-foreground">Tipo</label>
        <div className="mt-1 flex gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="tipo" value="fixa" checked={tipo === "fixa"} onChange={() => setTipo("fixa")} />
            Fixa mensal
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="tipo" value="avulsa" checked={tipo === "avulsa"} onChange={() => setTipo("avulsa")} />
            Avulsa (mês único)
          </label>
        </div>
      </div>

      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">Descrição</span>
        <input
          name="descricao"
          required
          defaultValue={defaults?.descricao}
          className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">Categoria</span>
        <select name="categoria" required defaultValue={defaults?.categoria ?? "outros"} className="w-full h-9 rounded-md border bg-card px-2 text-sm">
          {EXPENSE_CATEGORIAS.map((c) => (
            <option key={c} value={c}>{CATEGORIA_LABEL[c]}</option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">Valor (R$)</span>
        <input
          name="valor"
          type="number"
          step="0.01"
          min="0"
          required
          defaultValue={defaults?.valor ?? 0}
          className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm tabular-nums"
        />
      </label>

      {tipo === "avulsa" && (
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Mês de referência</span>
          <input
            name="mes_referencia"
            type="month"
            required
            defaultValue={defaults?.mes_referencia ?? monthNow()}
            className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm"
          />
        </label>
      )}

      {tipo === "fixa" && (
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">Início (opcional)</span>
            <input
              name="inicio_mes"
              type="month"
              defaultValue={defaults?.inicio_mes ?? ""}
              className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">Fim (opcional)</span>
            <input
              name="fim_mes"
              type="month"
              defaultValue={defaults?.fim_mes ?? ""}
              className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm"
            />
          </label>
        </div>
      )}

      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">Notas (opcional)</span>
        <textarea
          name="notas"
          rows={2}
          defaultValue={defaults?.notas ?? ""}
          className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm"
        />
      </label>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={pending}>Cancelar</Button>
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Salvando..." : (isEdit ? "Salvar" : "Criar")}</Button>
      </div>
    </form>
  );
}
