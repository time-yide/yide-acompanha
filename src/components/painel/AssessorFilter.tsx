"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface Props {
  current: string | null;
  options: Array<{ id: string; nome: string }>;
}

export function AssessorFilter({ current, options }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  function setAssessor(id: string) {
    const sp = new URLSearchParams(params.toString());
    if (!id) sp.delete("assessor");
    else sp.set("assessor", id);
    router.push(`/painel?${sp.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="assessor-filter" className="text-xs text-muted-foreground">Assessor:</label>
      <select
        id="assessor-filter"
        value={current ?? ""}
        onChange={(e) => setAssessor(e.target.value)}
        className="rounded-md border bg-card px-2 py-1.5 text-sm"
      >
        <option value="">Todos</option>
        {options.map((p) => (
          <option key={p.id} value={p.id}>{p.nome}</option>
        ))}
      </select>
    </div>
  );
}
