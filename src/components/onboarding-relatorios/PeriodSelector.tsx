"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Calendar } from "lucide-react";
import { PERIOD_LABELS, type PeriodKey } from "@/lib/onboarding-relatorios/queries";

interface Props {
  current: PeriodKey;
}

const ORDER: PeriodKey[] = ["este_mes", "mes_passado", "ultimos_3_meses", "este_ano"];

export function PeriodSelector({ current }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as PeriodKey;
    const usp = new URLSearchParams(params?.toString());
    usp.set("period", next);
    startTransition(() => {
      router.replace(`/onboarding/relatorios?${usp.toString()}`);
    });
  }

  return (
    <label className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-card/40 px-3 py-1.5 text-sm">
      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
      <select
        value={current}
        onChange={handleChange}
        disabled={pending}
        className="bg-transparent text-sm font-medium outline-none"
      >
        {ORDER.map((k) => (
          <option key={k} value={k}>
            {PERIOD_LABELS[k]}
          </option>
        ))}
      </select>
    </label>
  );
}
