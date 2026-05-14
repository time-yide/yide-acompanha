"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface Props {
  responsaveis: Array<{ id: string; nome: string }>;
  current: string;
}

export function CarteiraResponsavelSelector({ responsaveis, current }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("responsavel", value);
    params.delete("status");
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Ver carteira de:</span>
      <select
        value={current}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 rounded-md border bg-card px-2 text-sm"
      >
        <option value="">Selecione</option>
        {responsaveis.map((r) => (
          <option key={r.id} value={r.id}>{r.nome}</option>
        ))}
      </select>
    </div>
  );
}
