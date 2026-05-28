import { fraseDoDia } from "@/lib/freela-yide/frases";
import type { FreelaStats } from "@/lib/freela-yide/queries";

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider text-white/50">{label}</p>
      <p className="text-2xl font-extrabold tabular-nums text-white">{value}</p>
      <p className="text-[11px] text-white/60">{sub}</p>
    </div>
  );
}

export function FreelaHero({ stats }: { stats: FreelaStats }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 p-6"
      style={{ background: "radial-gradient(120% 140% at 0% 0%, rgba(124,58,237,.30), transparent 55%), radial-gradient(120% 140% at 100% 0%, rgba(34,211,238,.20), transparent 55%), linear-gradient(180deg,#0b0a14,#120e1f)" }}>
      <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/40 bg-violet-500/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-violet-200">Oportunidades extras</div>
      <h1 className="mt-3 bg-gradient-to-r from-white via-violet-200 to-cyan-300 bg-clip-text text-5xl font-extrabold tracking-tight text-transparent">FreelaYide</h1>
      <p className="mt-1 text-sm text-white/70">{fraseDoDia()}</p>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Disponíveis" value={String(stats.disponiveis)} sub="oportunidades" />
        <Stat label="Em jogo" value={`R$ ${stats.comissaoEmJogo.toLocaleString("pt-BR")}`} sub="valor potencial" />
        <Stat label="Você ganhou" value={`R$ ${stats.ganhoNoMes.toLocaleString("pt-BR")}`} sub="este mês" />
        <Stat label="Seu rank" value={stats.meuRank ? `#${stats.meuRank}` : "—"} sub={`${stats.meusPontos} pts`} />
      </div>
    </div>
  );
}
