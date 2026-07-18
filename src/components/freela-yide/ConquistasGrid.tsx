import { Crown, Flame, Gem, Lock, Pickaxe, Rocket, Shield, Sparkles, Swords, Target, Zap, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CONQUISTAS, progressoDe, type ConquistaDef, type ConquistaStats } from "@/lib/freela-yide/conquistas";

const ICONES: Record<string, LucideIcon> = {
  Rocket, Zap, Pickaxe, Target, Swords, Flame, Sparkles, Shield, Gem, Crown,
};

function fmtData(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function ConquistaCard({ def, desbloqueadaEm, stats }: { def: ConquistaDef; desbloqueadaEm: string | null; stats: ConquistaStats }) {
  const ganha = desbloqueadaEm !== null;
  const Icone = ICONES[def.icone] ?? Sparkles;
  const atual = Math.min(progressoDe(def, stats), def.meta);
  return (
    <Card className={`flex flex-col items-center gap-2 p-4 text-center ${ganha ? "ring-1 ring-white/15" : "opacity-70"}`}>
      <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${ganha ? "border-white/15 bg-white/5" : "border-white/10 bg-white/[0.02]"}`}>
        {ganha
          ? <Icone className={`h-7 w-7 ${def.cor}`} />
          : <Lock className="h-6 w-6 text-muted-foreground" />}
      </div>
      <p className={`text-sm font-bold ${ganha ? "" : "text-muted-foreground"}`}>{def.titulo}</p>
      {ganha ? (
        <p className="text-[11px] text-muted-foreground">Desbloqueada em {fmtData(desbloqueadaEm)}</p>
      ) : (
        <>
          <p className="text-[11px] text-muted-foreground">{def.descricao}</p>
          <p className="text-[11px] font-medium tabular-nums text-muted-foreground">{atual.toLocaleString("pt-BR")} / {def.meta.toLocaleString("pt-BR")}</p>
        </>
      )}
    </Card>
  );
}

export function ConquistasGrid({ desbloqueadas, stats }: { desbloqueadas: Record<string, string>; stats: ConquistaStats }) {
  const total = CONQUISTAS.length;
  const ganhas = CONQUISTAS.filter((c) => desbloqueadas[c.key]).length;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground tabular-nums">{ganhas} de {total} conquistas</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {CONQUISTAS.map((c) => (
          <ConquistaCard key={c.key} def={c} desbloqueadaEm={desbloqueadas[c.key] ?? null} stats={stats} />
        ))}
      </div>
    </div>
  );
}
