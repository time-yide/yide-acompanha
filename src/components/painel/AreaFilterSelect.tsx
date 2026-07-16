"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { AREA_FILTERS, AREA_LABELS, type AreaFilter } from "@/lib/painel/area-filter";

interface Props {
  current: AreaFilter;
}

/**
 * Filtro de área como dropdown (substitui a 2ª fileira de chips no topo do
 * painel, que duplicava visualmente os chips de tipo de pacote). Mesma
 * mecânica de query param `area`; só muda a UI pra reduzir poluição.
 */
export function AreaFilterSelect({ current }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  function setArea(area: string) {
    const sp = new URLSearchParams(params.toString());
    if (!area || area === "todos") sp.delete("area");
    else sp.set("area", area);
    router.push(`/painel?${sp.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="area-filter" className="text-xs text-muted-foreground">Área:</label>
      <select
        id="area-filter"
        value={current}
        onChange={(e) => setArea(e.target.value)}
        className="rounded-md border bg-card px-2 py-1.5 text-sm"
      >
        {AREA_FILTERS.map((a) => (
          <option key={a} value={a}>{AREA_LABELS[a]}</option>
        ))}
      </select>
    </div>
  );
}
