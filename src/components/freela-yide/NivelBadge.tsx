import { Sparkles, Target } from "lucide-react";
import type { Nivel } from "@/lib/freela-yide/niveis";

export function NivelBadge({ nivel, rival }: { nivel: Nivel; rival: string }) {
  const legenda = nivel.xpProximo === null
    ? "Nível máximo"
    : `${nivel.xpAtual.toLocaleString("pt-BR")} / ${nivel.xpProximo.toLocaleString("pt-BR")} pts · faltam ${nivel.faltam.toLocaleString("pt-BR")} pra ${nivel.proximoTitulo}`;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-extrabold ${nivel.cor}`}>
          <Sparkles className="h-4 w-4" /> Nv {nivel.nivel} · {nivel.titulo}
        </span>
        <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all" style={{ width: `${nivel.pct}%` }} />
        </div>
        <p className="mt-1.5 text-[11px] tabular-nums text-white/60">{legenda}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/80 sm:max-w-[220px]">
        <Target className="h-3.5 w-3.5 shrink-0 text-cyan-300" /> <span className="min-w-0">{rival}</span>
      </div>
    </div>
  );
}
