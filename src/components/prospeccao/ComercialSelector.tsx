"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface Props {
  comerciais: Array<{ id: string; nome: string }>;
  current: string;
}

export function ComercialSelector({ comerciais, current }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("comercial_id", value);
    else params.delete("comercial_id");
    router.push(`?${params.toString()}`);
  }

  return (
    <select
      value={current}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 rounded-md border bg-card px-2 text-sm"
    >
      <option value="">Todos</option>
      {comerciais.map((c) => (
        <option key={c.id} value={c.id}>{c.nome}</option>
      ))}
    </select>
  );
}
