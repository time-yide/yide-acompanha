"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { AtualizarPainelButton } from "./AtualizarPainelButton";

interface Props {
  mesAtual: string;
  mesesDisponiveis: string[];
  canAtualizar?: boolean;
}

function formatMonthLabel(monthRef: string): string {
  const [y, m] = monthRef.split("-");
  const names = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${names[Number(m) - 1]}/${y.slice(2)}`;
}

export function PainelHeader({ mesAtual, mesesDisponiveis, canAtualizar = false }: Props) {
  const router = useRouter();
  const params = useSearchParams();

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
          {canAtualizar && <AtualizarPainelButton mesReferencia={mesAtual} />}
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
    </header>
  );
}
