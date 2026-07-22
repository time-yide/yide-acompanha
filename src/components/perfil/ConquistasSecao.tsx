import { Card } from "@/components/ui/card";
import { Trophy, CalendarClock, ListChecks, Sparkles, Target, Clapperboard, Phone, Lock } from "lucide-react";
import type { ConquistaCard } from "@/lib/conquistas/queries";
import { CATEGORIA_LABEL, type CategoriaConquista } from "@/lib/conquistas/catalogo";

const ICONES = { CalendarClock, ListChecks, Sparkles, Target, Clapperboard, Phone } as Record<string, React.ComponentType<{ className?: string }>>;
const ORDEM: CategoriaConquista[] = ["tempo", "produtividade", "engajamento", "area"];

function Medalha({ c }: { c: ConquistaCard }) {
  const Icon = ICONES[c.icone] ?? Trophy;
  const atual = Math.max(0, c.atual);
  const pct = c.alvo > 0 ? Math.min(100, Math.round((atual / c.alvo) * 100)) : (c.desbloqueada ? 100 : 0);
  return (
    <div className={`rounded-lg border p-3 ${c.desbloqueada ? "border-primary/40 bg-primary/5" : "opacity-70"}`}>
      <div className="flex items-center gap-2">
        <span className={`flex h-8 w-8 items-center justify-center rounded-full ${c.desbloqueada ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
          {c.desbloqueada ? <Icon className="h-4 w-4" /> : <Lock className="h-3.5 w-3.5" />}
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium">{c.titulo}</p>
          <p className="truncate text-[10px] text-muted-foreground">{c.descricao}</p>
        </div>
      </div>
      {!c.desbloqueada && c.alvo > 1 && (
        <div className="mt-2">
          <div className="h-1.5 rounded-full bg-muted"><div className="h-1.5 rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>
          <p className="mt-1 text-[10px] text-muted-foreground">{atual}/{c.alvo}</p>
        </div>
      )}
    </div>
  );
}

export function ConquistasSecao({ conquistas }: { conquistas: ConquistaCard[] }) {
  const desbloqueadas = conquistas.filter((c) => c.desbloqueada).length;
  return (
    <Card className="space-y-3 p-4">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Trophy className="h-4 w-4" />Conquistas
        <span className="ml-auto text-xs text-muted-foreground">{desbloqueadas}/{conquistas.length}</span>
      </p>
      {ORDEM.map((cat) => {
        const doGrupo = conquistas.filter((c) => c.categoria === cat);
        if (doGrupo.length === 0) return null;
        return (
          <div key={cat} className="space-y-2">
            <p className="text-[11px] font-medium text-muted-foreground">{CATEGORIA_LABEL[cat]}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {doGrupo.map((c) => <Medalha key={c.key} c={c} />)}
            </div>
          </div>
        );
      })}
    </Card>
  );
}
