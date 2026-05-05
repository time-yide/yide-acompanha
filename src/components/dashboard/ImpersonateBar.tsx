"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface Colaborador {
  id: string;
  nome: string;
  role: string;
}

interface Props {
  colaboradores: Colaborador[];
  currentTargetId: string | null;
  isImpersonating: boolean;
}

const ROLE_LABEL: Record<string, string> = {
  socio: "Sócio",
  adm: "Adm",
  comercial: "Comercial",
  coordenador: "Coordenador",
  assessor: "Assessor",
  videomaker: "Videomaker",
  designer: "Designer",
  editor: "Editor",
  audiovisual_chefe: "Audiovisual Chefe",
};

export function ImpersonateBar({ colaboradores, currentTargetId, isImpersonating }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set("as", value);
    } else {
      params.delete("as");
    }
    router.push(`?${params.toString()}`);
  }

  function onClear() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("as");
    router.push(`?${params.toString()}`);
  }

  const current = currentTargetId
    ? colaboradores.find((c) => c.id === currentTargetId)
    : null;

  if (isImpersonating) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm">
        <span className="text-amber-700 dark:text-amber-300">
          👁 Visualizando como <strong>{current?.nome ?? "—"}</strong>
          {current && (
            <span className="ml-1 opacity-70">
              ({ROLE_LABEL[current.role] ?? current.role})
            </span>
          )}
        </span>
        <div className="flex items-center gap-2">
          <select
            value={currentTargetId ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 rounded-md border bg-card px-2 text-xs"
          >
            {colaboradores.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} · {ROLE_LABEL[c.role] ?? c.role}
              </option>
            ))}
          </select>
          <button
            onClick={onClear}
            className="text-xs font-medium text-amber-700 hover:underline dark:text-amber-300"
          >
            Voltar pro meu →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
      <span>Ver dashboard como:</span>
      <select
        value=""
        onChange={(e) => onChange(e.target.value)}
        className="h-7 rounded-md border bg-card px-2 text-xs"
      >
        <option value="">— Selecione —</option>
        {colaboradores.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome} · {ROLE_LABEL[c.role] ?? c.role}
          </option>
        ))}
      </select>
    </div>
  );
}
