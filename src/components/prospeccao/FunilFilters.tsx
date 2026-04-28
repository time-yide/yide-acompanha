"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface Props {
  comerciais: Array<{ id: string; nome: string }>;
  showComercialFilter: boolean;
}

const PERIOD_OPTIONS = [
  { value: "3", label: "Últimos 3 meses" },
  { value: "6", label: "Últimos 6 meses" },
  { value: "12", label: "Últimos 12 meses" },
];

export function FunilFilters({ comerciais, showComercialFilter }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentPeriod = searchParams.get("period") ?? "12";
  const currentComercial = searchParams.get("comercial_id") ?? "";

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Período:</span>
        <select
          value={currentPeriod}
          onChange={(e) => setParam("period", e.target.value)}
          className="h-8 rounded-md border bg-card px-2 text-sm"
        >
          {PERIOD_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      </div>
      {showComercialFilter && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Comercial:</span>
          <select
            value={currentComercial}
            onChange={(e) => setParam("comercial_id", e.target.value)}
            className="h-8 rounded-md border bg-card px-2 text-sm"
          >
            <option value="">Todos</option>
            {comerciais.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}
