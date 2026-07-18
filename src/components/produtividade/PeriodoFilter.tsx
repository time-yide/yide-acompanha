"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

const RANGES = [
  { key: "dia", label: "Dia" },
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mês" },
] as const;

type Range = (typeof RANGES)[number]["key"];

interface Props {
  range: Range;
  de?: string;
  ate?: string;
}

export function PeriodoFilter({ range, de, ate }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const customAtivo = !!(de && ate);

  function push(sp: URLSearchParams) {
    const qs = sp.toString();
    startTransition(() => router.push(`/produtividade${qs ? `?${qs}` : ""}`));
  }

  function selectRange(r: Range) {
    const sp = new URLSearchParams(searchParams);
    sp.delete("de");
    sp.delete("ate");
    if (r === "dia") sp.delete("range");
    else sp.set("range", r);
    push(sp);
  }

  function setData(campo: "de" | "ate", valor: string) {
    const sp = new URLSearchParams(searchParams);
    if (valor) sp.set(campo, valor);
    else sp.delete(campo);
    sp.delete("range"); // entrando em modo personalizado
    push(sp);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="tablist" aria-label="Filtro de período" className="inline-flex rounded-lg border bg-card p-0.5">
        {RANGES.map((r) => {
          const active = !customAtivo && range === r.key;
          return (
            <button
              key={r.key}
              type="button"
              role="tab"
              aria-selected={active}
              disabled={pending}
              onClick={() => selectRange(r.key)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
              } disabled:opacity-60`}
            >
              {r.label}
            </button>
          );
        })}
      </div>

      <div className={`inline-flex items-center gap-1.5 rounded-lg border bg-card px-2 py-1 text-xs ${customAtivo ? "ring-1 ring-primary/40" : ""}`}>
        <span className="text-muted-foreground">De</span>
        <input
          type="date"
          value={de ?? ""}
          max={ate || undefined}
          disabled={pending}
          onChange={(e) => setData("de", e.target.value)}
          className="bg-transparent text-foreground outline-none [color-scheme:dark]"
          aria-label="Data inicial"
        />
        <span className="text-muted-foreground">até</span>
        <input
          type="date"
          value={ate ?? ""}
          min={de || undefined}
          disabled={pending}
          onChange={(e) => setData("ate", e.target.value)}
          className="bg-transparent text-foreground outline-none [color-scheme:dark]"
          aria-label="Data final"
        />
      </div>
    </div>
  );
}
