"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PACOTES_NO_PAINEL_MENSAL, tipoPacoteBadge, type TipoPacote } from "@/lib/painel/pacote-matrix";
import { cn } from "@/lib/utils";

interface Props {
  mesAtual: string;
  mesesDisponiveis: string[];
  tipoFiltro: TipoPacote | "todos";
}

function formatMonthLabel(monthRef: string): string {
  const [y, m] = monthRef.split("-");
  const names = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${names[Number(m) - 1]}/${y.slice(2)}`;
}

export function PainelHeader({ mesAtual, mesesDisponiveis, tipoFiltro }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  function setTipo(tipo: string) {
    const sp = new URLSearchParams(params.toString());
    if (tipo === "todos") sp.delete("tipo"); else sp.set("tipo", tipo);
    router.push(`/painel?${sp.toString()}`);
  }

  function setMes(mes: string) {
    const sp = new URLSearchParams(params.toString());
    sp.set("mes", mes);
    router.push(`/painel?${sp.toString()}`);
  }

  return (
    <header className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Painel mensal</h1>
          <p className="text-sm text-muted-foreground">Acompanhamento de etapas por cliente</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/painel/legacy"
            className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
          >
            Versão antiga →
          </Link>
          <select
            value={mesAtual}
            onChange={(e) => setMes(e.target.value)}
            className="rounded-md border bg-card px-2 py-1.5 text-sm"
          >
            {mesesDisponiveis.map((m) => (
              <option key={m} value={m}>{formatMonthLabel(m)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setTipo("todos")}
          className={cn(
            "rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
            tipoFiltro === "todos"
              ? "border-foreground/30 bg-foreground/5"
              : "border-muted-foreground/20 bg-muted/40 text-muted-foreground",
          )}
        >
          Todos
        </button>
        {(PACOTES_NO_PAINEL_MENSAL as readonly TipoPacote[]).map((p) => {
          const meta = tipoPacoteBadge(p);
          const active = tipoFiltro === p;
          return (
            <button
              key={p}
              type="button"
              onClick={() => setTipo(p)}
              className={cn(
                "rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
                active
                  ? meta.classes
                  : "border-muted-foreground/20 bg-muted/40 text-muted-foreground",
              )}
            >
              {meta.label}
            </button>
          );
        })}
      </div>
    </header>
  );
}
