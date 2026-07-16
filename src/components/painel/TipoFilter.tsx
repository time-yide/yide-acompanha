"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { PACOTES_NO_PAINEL_MENSAL, tipoPacoteBadge, type TipoPacote } from "@/lib/painel/pacote-matrix";
import { cn } from "@/lib/utils";

interface Props {
  current: TipoPacote | "todos";
}

/**
 * Chips de filtro por tipo de pacote. Extraído do PainelHeader pra compor o
 * bloco único de filtros (tipo + área) no topo do painel.
 */
export function TipoFilter({ current }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  function setTipo(tipo: string) {
    const sp = new URLSearchParams(params.toString());
    if (tipo === "todos") sp.delete("tipo"); else sp.set("tipo", tipo);
    router.push(`/painel?${sp.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => setTipo("todos")}
        className={cn(
          "rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
          current === "todos"
            ? "border-foreground/30 bg-foreground/5"
            : "border-muted-foreground/20 bg-muted/40 text-muted-foreground hover:bg-muted/60",
        )}
      >
        Todos
      </button>
      {(PACOTES_NO_PAINEL_MENSAL as readonly TipoPacote[]).map((p) => {
        const meta = tipoPacoteBadge(p);
        const active = current === p;
        return (
          <button
            key={p}
            type="button"
            onClick={() => setTipo(p)}
            className={cn(
              "rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
              active
                ? meta.classes
                : "border-muted-foreground/20 bg-muted/40 text-muted-foreground hover:bg-muted/60",
            )}
          >
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}
