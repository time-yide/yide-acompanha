"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { bulkAssignClientesAction } from "@/lib/clientes/actions";

interface Option {
  id: string;
  nome: string;
}

interface Props {
  selectedIds: string[];
  assessores: Option[];
  coordenadores: Option[];
  onClearSelection: () => void;
}

// Sentinela para "não tocar nesse campo" — diferente de "" que significa unassign.
const UNTOUCHED = "__untouched__";

export function BulkAssignmentBar({
  selectedIds,
  assessores,
  coordenadores,
  onClearSelection,
}: Props) {
  const [assessor, setAssessor] = useState<string>(UNTOUCHED);
  const [coordenador, setCoordenador] = useState<string>(UNTOUCHED);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (selectedIds.length === 0) return null;

  const bothUntouched = assessor === UNTOUCHED && coordenador === UNTOUCHED;

  function handleApply() {
    setError(null);
    const fd = new FormData();
    fd.set("cliente_ids", JSON.stringify(selectedIds));
    if (assessor !== UNTOUCHED) fd.set("assessor_id", assessor);
    if (coordenador !== UNTOUCHED) fd.set("coordenador_id", coordenador);

    startTransition(async () => {
      const result = await bulkAssignClientesAction(fd);
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      // Sucesso: limpa seleção e reseta selects para a barra recolher.
      setAssessor(UNTOUCHED);
      setCoordenador(UNTOUCHED);
      onClearSelection();
    });
  }

  return (
    <div className="sticky top-0 z-30 border-b bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-3 p-3">
        <span className="text-sm font-medium">
          {selectedIds.length} selecionado(s)
        </span>

        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Atribuir assessor</span>
          <select
            value={assessor}
            onChange={(e) => setAssessor(e.target.value)}
            disabled={pending}
            className="rounded-md border border-input bg-card px-2 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value={UNTOUCHED}>—</option>
            <option value="">(Sem atribuição)</option>
            {assessores.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Atribuir coordenador</span>
          <select
            value={coordenador}
            onChange={(e) => setCoordenador(e.target.value)}
            disabled={pending}
            className="rounded-md border border-input bg-card px-2 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value={UNTOUCHED}>—</option>
            <option value="">(Sem atribuição)</option>
            {coordenadores.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
              </option>
            ))}
          </select>
        </label>

        <div className="ml-auto flex items-center gap-2">
          {error && (
            <span className="text-xs text-destructive">{error}</span>
          )}
          <Button
            type="button"
            size="sm"
            onClick={handleApply}
            disabled={bothUntouched || pending}
          >
            {pending ? "Aplicando..." : "Aplicar"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            disabled={pending}
          >
            Cancelar seleção
          </Button>
        </div>
      </div>
    </div>
  );
}
