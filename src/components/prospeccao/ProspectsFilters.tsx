"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

const STATUS_OPTIONS = [
  { value: "prospeccao", label: "Prospecção" },
  { value: "comercial", label: "Em comercial" },
  { value: "contrato", label: "Contrato" },
  { value: "marco_zero", label: "Marco zero" },
  { value: "ativo", label: "Ativo" },
  { value: "perdido", label: "Perdido" },
];

interface Props {
  comerciais: Array<{ id: string; nome: string }>;
  showComercialFilter: boolean;
}

export function ProspectsFilters({ comerciais, showComercialFilter }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const currentStatuses = searchParams.get("status")?.split(",") ?? [];
  const currentComercial = searchParams.get("comercial_id") ?? "";
  const currentValorMin = searchParams.get("valor_min") ?? "";
  const currentValorMax = searchParams.get("valor_max") ?? "";

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => router.push(`?${params.toString()}`));
  }

  function toggleStatus(status: string) {
    const next = currentStatuses.includes(status)
      ? currentStatuses.filter((s) => s !== status)
      : [...currentStatuses, status];
    setParam("status", next.join(","));
  }

  return (
    <div className="space-y-3 rounded-lg border bg-card p-3">
      <div>
        <span className="text-xs font-medium text-muted-foreground">Status</span>
        <div className="mt-1 flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((opt) => {
            const isActive = currentStatuses.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleStatus(opt.value)}
                className={`rounded-full px-3 py-1 text-xs transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {showComercialFilter && (
          <div>
            <label className="text-xs font-medium text-muted-foreground">Comercial</label>
            <select
              value={currentComercial}
              onChange={(e) => setParam("comercial_id", e.target.value)}
              className="mt-1 block w-full h-8 rounded-md border bg-card px-2 text-sm"
            >
              <option value="">Todos</option>
              {comerciais.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="text-xs font-medium text-muted-foreground">Valor mín. (R$)</label>
          <input
            type="number"
            value={currentValorMin}
            onChange={(e) => setParam("valor_min", e.target.value)}
            className="mt-1 block w-full h-8 rounded-md border bg-card px-2 text-sm"
            placeholder="0"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Valor máx. (R$)</label>
          <input
            type="number"
            value={currentValorMax}
            onChange={(e) => setParam("valor_max", e.target.value)}
            className="mt-1 block w-full h-8 rounded-md border bg-card px-2 text-sm"
            placeholder="∞"
          />
        </div>
      </div>
    </div>
  );
}
