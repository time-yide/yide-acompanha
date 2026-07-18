import { Crown, Medal } from "lucide-react";
import type { RankingEntry } from "@/lib/freela-yide/queries";

// index 0 = 1º ouro, 1 = 2º prata, 2 = 3º bronze
const DEGRAUS = [
  { cor: "border-amber-400/50 bg-amber-500/15 text-amber-200",   altura: "h-24", ring: "ring-amber-400/50" },
  { cor: "border-slate-300/40 bg-slate-400/15 text-slate-200",   altura: "h-20", ring: "ring-slate-300/50" },
  { cor: "border-orange-400/40 bg-orange-500/15 text-orange-200", altura: "h-16", ring: "ring-orange-400/50" },
];

export function Podio({ top3, meId }: { top3: RankingEntry[]; meId: string }) {
  if (top3.length === 0) return null;
  // Ordem visual do pódio: 2º à esquerda, 1º no centro (maior), 3º à direita.
  const ordem: Array<{ pos: number; entry: RankingEntry }> = [];
  if (top3[1]) ordem.push({ pos: 2, entry: top3[1] });
  if (top3[0]) ordem.push({ pos: 1, entry: top3[0] });
  if (top3[2]) ordem.push({ pos: 3, entry: top3[2] });
  return (
    <div className="flex items-end justify-center gap-2 rounded-xl border bg-card p-3">
      {ordem.map(({ pos, entry }) => {
        const d = DEGRAUS[pos - 1];
        const ehVoce = entry.user_id === meId;
        return (
          <div key={entry.user_id} className="flex flex-1 flex-col items-center">
            {pos === 1
              ? <Crown className="mb-1 h-5 w-5 text-amber-300" />
              : <Medal className={`mb-1 h-4 w-4 ${pos === 2 ? "text-slate-300" : "text-orange-300"}`} />}
            <div className={`flex ${d.altura} w-full flex-col items-center justify-end rounded-lg border ${d.cor} px-2 py-2 ${ehVoce ? `ring-1 ${d.ring}` : ""}`}>
              <span className="text-lg font-extrabold tabular-nums">{pos}º</span>
            </div>
            <p className="mt-1 w-full truncate text-center text-xs font-semibold">
              {entry.nome}{ehVoce && <span className="text-violet-400"> (você)</span>}
            </p>
            <p className="text-[11px] tabular-nums text-muted-foreground">{entry.pontos} pts</p>
          </div>
        );
      })}
    </div>
  );
}
