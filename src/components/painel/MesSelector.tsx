"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface Props {
  current: string;
  options: string[];
}

const MONTH_LABELS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function format(monthRef: string): string {
  const [y, m] = monthRef.split("-");
  return `${MONTH_LABELS_PT[Number(m) - 1]}/${y}`;
}

export function MesSelector({ current, options }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("mes", value);
    router.push(`?${params.toString()}`);
  }

  return (
    <select
      value={current}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 rounded-md border bg-card px-2 text-sm"
    >
      {options.map((m) => (
        <option key={m} value={m}>{format(m)}</option>
      ))}
    </select>
  );
}
