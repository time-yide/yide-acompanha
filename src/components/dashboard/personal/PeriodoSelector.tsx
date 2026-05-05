"use client";

import { useRouter, useSearchParams } from "next/navigation";

const PERIODOS = [
  { value: "mes_atual", label: "Este mês" },
  { value: "mes_anterior", label: "Mês passado" },
  { value: "dias_7", label: "Últimos 7 dias" },
  { value: "total", label: "Tudo" },
] as const;

interface Props {
  current: string;
}

export function PeriodoSelector({ current }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "mes_atual") {
      params.delete("periodo");
    } else {
      params.set("periodo", value);
    }
    router.push(`?${params.toString()}`);
  }

  return (
    <select
      value={current}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 rounded-md border bg-card px-2 text-xs"
    >
      {PERIODOS.map((p) => (
        <option key={p.value} value={p.value}>{p.label}</option>
      ))}
    </select>
  );
}
