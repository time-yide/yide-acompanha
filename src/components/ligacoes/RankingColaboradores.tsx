import Image from "next/image";
import { Trophy, TrendingUp, Phone, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatDuracao } from "@/lib/ligacoes/tipos";
import type { RankingColaborador } from "@/lib/ligacoes/queries";

interface Props {
  ranking: RankingColaborador[];
}

const TROPHY_COLORS = ["text-amber-400", "text-slate-400", "text-orange-600"];

export function RankingColaboradores({ ranking }: Props) {
  if (ranking.length === 0) {
    return (
      <Card className="p-5 space-y-3">
        <h2 className="font-semibold text-sm flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" /> Ranking de colaboradores
        </h2>
        <p className="text-xs text-muted-foreground text-center py-8">
          Sem dados no período. Popula dados de exemplo pra ver o dashboard funcionando.
        </p>
      </Card>
    );
  }

  const maxTotal = ranking[0].total;

  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" /> Ranking de colaboradores
        </h2>
        <span className="text-[10px] text-muted-foreground">por total de chamadas</span>
      </div>

      <div className="space-y-2">
        {ranking.slice(0, 10).map((r, idx) => {
          const widthPct = (r.total / maxTotal) * 100;
          return (
            <div key={r.colaborador_id} className="relative overflow-hidden rounded-lg border bg-card p-3">
              {/* Barra de progresso de fundo */}
              <div
                className="absolute inset-y-0 left-0 bg-primary/5"
                style={{ width: `${widthPct}%` }}
              />

              <div className="relative flex items-center gap-3">
                {/* Posição / troféu */}
                <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                  {idx < 3 ? (
                    <Trophy className={`h-5 w-5 ${TROPHY_COLORS[idx]}`} />
                  ) : (
                    <span className="text-xs font-bold text-muted-foreground">#{idx + 1}</span>
                  )}
                </div>

                {/* Avatar */}
                {r.avatar_url ? (
                  <Image
                    src={r.avatar_url}
                    alt={r.colaborador_nome}
                    width={32}
                    height={32}
                    sizes="32px"
                    className="h-8 w-8 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
                    {r.colaborador_nome.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                )}

                {/* Nome + role */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.colaborador_nome}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{r.role}</p>
                </div>

                {/* Stats */}
                <div className="hidden sm:flex shrink-0 gap-3 text-right">
                  <Stat icon={Phone} value={r.total} label="total" tone="text-foreground" />
                  <Stat icon={TrendingUp} value={`${r.taxa_atendimento_pct}%`} label="atendimento" tone="text-emerald-600" />
                  <Stat icon={Clock} value={formatDuracao(r.duracao_media_seg)} label="média" tone="text-violet-600" />
                </div>
                <div className="sm:hidden flex flex-col items-end">
                  <span className="text-sm font-bold tabular-nums">{r.total}</span>
                  <span className="text-[9px] text-muted-foreground">{r.taxa_atendimento_pct}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function Stat({ icon: Icon, value, label, tone }: { icon: React.ComponentType<{ className?: string }>; value: string | number; label: string; tone: string }) {
  return (
    <div className="flex flex-col items-end min-w-[50px]">
      <span className={`text-sm font-bold tabular-nums ${tone}`}>
        <Icon className="inline h-3 w-3 mr-0.5" />
        {value}
      </span>
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span>
    </div>
  );
}
