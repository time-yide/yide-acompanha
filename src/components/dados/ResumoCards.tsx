import { TrendingUp, TrendingDown, AlertTriangle, Target, Plug } from "lucide-react";
import { cobertura } from "@/lib/dados/nota";
import type { LinhaDados } from "@/lib/dados/queries";

export function ResumoCards({ linhas }: { linhas: LinhaDados[] }) {
  const comNota = linhas.filter((l) => l.nota != null);
  const media = comNota.length ? Math.round(comNota.reduce((s, l) => s + (l.nota ?? 0), 0) / comNota.length) : null;
  const comAnt = comNota.filter((l) => l.notaAnterior != null);
  const mediaAnt = comAnt.length ? Math.round(comAnt.reduce((s, l) => s + (l.notaAnterior ?? 0), 0) / comAnt.length) : null;
  const delta = media != null && mediaAnt != null ? media - mediaAnt : null;
  const risco = comNota.filter((l) => (l.nota ?? 100) < 50).length;
  const oportunidades = linhas.reduce((s, l) => s + l.perdas.filter((p) => p.gravidade === "alta").length, 0);
  const cob = cobertura(linhas.flatMap((l) => (l.canais ? [l.canais] : [])));
  const cobPct = cob.total ? Math.round((cob.lidos / cob.total) * 100) : 0;

  const card = "rounded-xl border border-white/10 bg-white/[0.03] p-4";
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div className={card}>
        <div className="text-xs uppercase tracking-wide text-white/50">Presença média</div>
        <div className="mt-1 text-3xl font-extrabold">{media ?? "—"}<span className="text-sm font-normal text-white/40">/100</span></div>
        {delta != null && (
          <div className={delta >= 0 ? "text-xs text-emerald-300" : "text-xs text-rose-300"}>
            {delta >= 0 ? <TrendingUp className="mr-1 inline h-3 w-3" /> : <TrendingDown className="mr-1 inline h-3 w-3" />}
            {delta >= 0 ? `+${delta}` : delta} vs mês anterior
          </div>
        )}
      </div>
      <div className={card}>
        <div className="flex items-center justify-between text-xs uppercase tracking-wide text-white/50">Clientes em risco <AlertTriangle className="h-4 w-4 text-rose-300" /></div>
        <div className="mt-1 text-3xl font-extrabold text-rose-300">{risco}</div>
        <div className="text-xs text-white/50">nota abaixo de 50</div>
      </div>
      <div className={card}>
        <div className="flex items-center justify-between text-xs uppercase tracking-wide text-white/50">Oportunidades abertas <Target className="h-4 w-4 text-amber-300" /></div>
        <div className="mt-1 text-3xl font-extrabold">{oportunidades}</div>
        <div className="text-xs text-white/50">canais sem presença</div>
      </div>
      <div className={card}>
        <div className="flex items-center justify-between text-xs uppercase tracking-wide text-white/50">Cobertura de dados <Plug className="h-4 w-4 text-cyan-300" /></div>
        <div className="mt-1 text-3xl font-extrabold">{cobPct}%</div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-cyan-400" style={{ width: `${cobPct}%` }} /></div>
      </div>
    </div>
  );
}
