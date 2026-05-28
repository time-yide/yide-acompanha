import { Card } from "@/components/ui/card";
import type { RankingEntry } from "@/lib/freela-yide/queries";

export function RankingTime({ ranking, meId }: { ranking: RankingEntry[]; meId: string }) {
  if (ranking.length === 0) return <Card className="p-6 text-center text-sm text-muted-foreground">Ranking começa quando alguém pegar a primeira oportunidade do mês.</Card>;
  return (
    <div className="space-y-1.5">
      {ranking.map((r, i) => (
        <Card key={r.user_id} className={`flex items-center gap-3 p-3 ${r.user_id === meId ? "ring-1 ring-violet-500/50" : ""}`}>
          <span className="w-7 text-center text-lg font-bold tabular-nums">{i + 1}º</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{r.nome}{r.user_id === meId && <span className="text-violet-400"> (você)</span>}</p>
            <p className="text-[11px] text-muted-foreground">{r.fechamentos} fechada(s) · R$ {r.comissao.toLocaleString("pt-BR")}</p>
          </div>
          <span className="rounded-full bg-gradient-to-r from-violet-600 to-cyan-400 px-3 py-1 text-xs font-bold text-white tabular-nums">{r.pontos} pts</span>
        </Card>
      ))}
    </div>
  );
}
