import { Clapperboard, TrendingUp, TrendingDown } from "lucide-react";
import type { TimeAudiovisualCard as TimeAudiovisualData } from "@/lib/produtividade/queries";
import { formatBRL, formatHours } from "./ProdutividadeSummaryCards";

export function TimeAudiovisualCard({ time }: { time: TimeAudiovisualData }) {
  const positivo = time.lucro >= 0;
  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400">
          <Clapperboard className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold">Time Audiovisual · {time.coordenador_nome}</h2>
          <p className="text-[11px] text-muted-foreground">
            {time.produtores} produtor{time.produtores === 1 ? "" : "es"} · resultado do time (já pagando o coordenador)
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Receita do time" value={formatBRL(time.receita)} />
        <Metric label="Custo (+ coord)" value={formatBRL(time.custo)} />
        <Metric
          label="Lucro do time"
          value={formatBRL(time.lucro)}
          tone={positivo ? "pos" : "neg"}
          icon={positivo ? TrendingUp : TrendingDown}
        />
        <Metric label="Entregas / tempo" value={`${time.entregas} · ${formatHours(time.tempo_ativo_seg)}`} />
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg";
  icon?: typeof TrendingUp;
}) {
  const color =
    tone === "pos"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "neg"
        ? "text-rose-600 dark:text-rose-400"
        : "";
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 flex items-center gap-1 text-lg font-bold tabular-nums ${color}`}>
        {Icon && <Icon className="h-4 w-4" />}
        {value}
      </div>
    </div>
  );
}
