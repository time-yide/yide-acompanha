import { Card } from "@/components/ui/card";
import { Gift } from "lucide-react";
import type { MetaRow, RankingEntry } from "@/lib/freela-yide/queries";
import { TIPO_ALVO_DEFS } from "@/lib/freela-yide/tipos";

export function MetaCard({ meta, ranking }: { meta: MetaRow | null; ranking: RankingEntry[] }) {
  if (!meta) return null;
  const total = ranking.reduce((s, r) => {
    if (meta.tipo_alvo === "pontos") return s + r.pontos;
    if (meta.tipo_alvo === "fechamentos") return s + r.fechamentos;
    return s + r.comissao;
  }, 0);
  const pct = meta.alvo > 0 ? Math.min(100, Math.round((total / meta.alvo) * 100)) : 0;
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Gift className="h-4 w-4 text-fuchsia-400" /> Meta do mês</h2>
        {meta.bonus_descricao && <span className="rounded-full bg-fuchsia-500/10 px-2 py-0.5 text-[11px] font-medium text-fuchsia-400">{meta.bonus_descricao}</span>}
      </div>
      <p className="text-sm">{meta.descricao}</p>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-gradient-to-r from-violet-600 to-cyan-400" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11px] text-muted-foreground tabular-nums">
        {total.toLocaleString("pt-BR")} / {meta.alvo.toLocaleString("pt-BR")} {TIPO_ALVO_DEFS[meta.tipo_alvo]} ({pct}%)
      </p>
    </Card>
  );
}
