"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { FreelaHistorico, RankingEntry, RankingGeralEntry } from "@/lib/freela-yide/queries";

type Aba = "mes" | "geral";

function LinhaRanking({ pos, nome, ehVoce, sub, destaque }: {
  pos: number; nome: string; ehVoce: boolean; sub: string; destaque: string;
}) {
  return (
    <Card className={`flex items-center gap-3 p-3 ${ehVoce ? "ring-1 ring-violet-500/50" : ""}`}>
      <span className="w-7 text-center text-lg font-bold tabular-nums">{pos}º</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{nome}{ehVoce && <span className="text-violet-400"> (você)</span>}</p>
        <p className="text-[11px] text-muted-foreground">{sub}</p>
      </div>
      <span className="whitespace-nowrap rounded-full bg-gradient-to-r from-violet-600 to-cyan-400 px-3 py-1 text-xs font-bold text-white tabular-nums">{destaque}</span>
    </Card>
  );
}

export function RankingPainel({ historico, meId }: { historico: FreelaHistorico; meId: string }) {
  const [aba, setAba] = useState<Aba>("mes");
  const [idx, setIdx] = useState(0); // 0 = mês mais recente
  const meses = historico.meses;
  const mesAtual = meses[idx];

  const btnAba = (a: Aba) =>
    `flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${aba === a ? "bg-gradient-to-r from-violet-600 to-cyan-400 text-white" : "text-muted-foreground hover:text-foreground"}`;

  return (
    <div className="space-y-2">
      <div className="flex gap-1 rounded-lg border bg-card p-1">
        <button type="button" className={btnAba("mes")} onClick={() => setAba("mes")}>Por mês</button>
        <button type="button" className={btnAba("geral")} onClick={() => setAba("geral")}>Geral</button>
      </div>

      {aba === "mes" && (
        <>
          {meses.length > 0 && (
            <div className="flex items-center justify-between rounded-lg border bg-card px-2 py-1.5">
              <button type="button" onClick={() => setIdx((i) => Math.min(meses.length - 1, i + 1))} disabled={idx >= meses.length - 1}
                className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label="Mês anterior">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold">{mesAtual?.label ?? "—"}</span>
              <button type="button" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx <= 0}
                className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label="Próximo mês">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
          {!mesAtual || mesAtual.ranking.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">Ninguém no ranking neste mês ainda.</Card>
          ) : (
            <div className="space-y-1.5">
              {mesAtual.ranking.map((r: RankingEntry, i) => (
                <LinhaRanking key={r.user_id} pos={i + 1} nome={r.nome} ehVoce={r.user_id === meId}
                  sub={`${r.fechamentos} fechada(s) · R$ ${r.comissao.toLocaleString("pt-BR")}`}
                  destaque={`${r.pontos} pts`} />
              ))}
            </div>
          )}
        </>
      )}

      {aba === "geral" && (
        <>
          <p className="flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
            <Trophy className="h-3.5 w-3.5 text-fuchsia-400" /> Acumulado de todos os tempos — quem mais pegou freelas
          </p>
          {historico.geral.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">Ninguém pegou freela ainda.</Card>
          ) : (
            <div className="space-y-1.5">
              {historico.geral.map((r: RankingGeralEntry, i) => (
                <LinhaRanking key={r.user_id} pos={i + 1} nome={r.nome} ehVoce={r.user_id === meId}
                  sub={`${r.fechamentos} fechada(s) · R$ ${r.comissao.toLocaleString("pt-BR")} · ${r.pontos} pts`}
                  destaque={`${r.pegas} freela${r.pegas === 1 ? "" : "s"}`} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
