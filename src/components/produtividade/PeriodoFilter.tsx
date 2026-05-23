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
  current: Range;
}

export function PeriodoFilter({ current }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function select(r: Range) {
    const sp = new URLSearchParams(searchParams);
    if (r === "dia") sp.delete("range");
    else sp.set("range", r);
    const qs = sp.toString();
    startTransition(() => {
      router.push(`/produtividade${qs ? `?${qs}` : ""}`);
    });
  }

  return (
    <div
      role="tablist"
      aria-label="Filtro de período"
      className="inline-flex rounded-lg border bg-card p-0.5"
    >
      {RANGES.map((r) => {
        const active = current === r.key;
        return (
          <button
            key={r.key}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={pending}
            onClick={() => select(r.key)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              active
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground"
            } disabled:opacity-60`}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}
