import Link from "next/link";
import { TrendingUp, TrendingDown } from "lucide-react";
import { SatisfactionSparkline } from "@/components/satisfacao/SatisfactionSparkline";
import type { SynthesisRowWithCliente } from "@/lib/dashboard/queries";
import { cn } from "@/lib/utils";

interface Props {
  top: SynthesisRowWithCliente[];
  bottom: SynthesisRowWithCliente[];
}

/** Estilo do badge de posição. Top 3 ganham destaque sutil (não emoji). */
function positionStyles(rank: number, kind: "top" | "bottom"): {
  bg: string;
  text: string;
  border: string;
} {
  if (kind === "top" && rank <= 3) {
    if (rank === 1) {
      return {
        bg: "bg-gradient-to-br from-amber-400 to-amber-600",
        text: "text-amber-50",
        border: "border-amber-500/40",
      };
    }
    if (rank === 2) {
      return {
        bg: "bg-gradient-to-br from-slate-300 to-slate-500",
        text: "text-slate-50",
        border: "border-slate-400/40",
      };
    }
    return {
      bg: "bg-gradient-to-br from-orange-500 to-orange-700",
      text: "text-orange-50",
      border: "border-orange-500/40",
    };
  }
  if (kind === "bottom" && rank <= 3) {
    return {
      bg: "bg-rose-500/15 dark:bg-rose-500/20",
      text: "text-rose-700 dark:text-rose-300",
      border: "border-rose-500/40",
    };
  }
  return {
    bg: "bg-muted",
    text: "text-muted-foreground",
    border: "border-border",
  };
}

function StatusBadge({ status, votos, esperados }: {
  status: "em_curso" | "completo";
  votos: number;
  esperados: number;
}) {
  if (status === "completo") {
    return (
      <span
        title={`${votos}/${esperados} avaliadores responderam`}
        className="inline-flex items-center rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300"
      >
        Completo
      </span>
    );
  }
  return (
    <span
      title={`${votos}/${esperados} avaliadores responderam · ranking ainda em formação`}
      className="inline-flex items-center gap-1 rounded-md border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-300"
    >
      <span className="h-1 w-1 animate-pulse rounded-full bg-sky-500" />
      Em curso · {votos}/{esperados}
    </span>
  );
}

function ScoreColor({ score }: { score: number }) {
  const cls =
    score >= 7.5
      ? "text-emerald-600 dark:text-emerald-400"
      : score >= 4
        ? "text-amber-600 dark:text-amber-400"
        : "text-rose-600 dark:text-rose-400";
  return (
    <span className={cn("font-bold tabular-nums", cls)}>
      {score.toFixed(1)}
    </span>
  );
}

function Item({ rank, s, kind }: {
  rank: number;
  s: SynthesisRowWithCliente;
  kind: "top" | "bottom";
}) {
  const style = positionStyles(rank, kind);

  return (
    <li className="group flex items-center gap-3 rounded-lg border border-border/50 bg-card/40 p-2.5 transition-colors hover:bg-card hover:border-border">
      <span
        className={cn(
          "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border text-xs font-bold tabular-nums shadow-sm",
          style.bg,
          style.text,
          style.border,
        )}
      >
        {rank}
      </span>

      <div className="flex flex-1 min-w-0 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            href={`/clientes/${s.client_id}/satisfacao`}
            className="font-medium text-sm truncate hover:underline"
          >
            {s.cliente?.nome ?? ""}
          </Link>
          <StatusBadge status={s.status} votos={s.votos_atuais} esperados={s.votos_esperados} />
        </div>
        <div className="opacity-70 group-hover:opacity-100 transition-opacity">
          <SatisfactionSparkline clientId={s.client_id} />
        </div>
      </div>

      <ScoreColor score={Number(s.score_final)} />
    </li>
  );
}

function Column({
  title,
  icon: Icon,
  iconColor,
  items,
  kind,
  emptyText,
}: {
  title: string;
  icon: typeof TrendingUp;
  iconColor: string;
  items: SynthesisRowWithCliente[];
  kind: "top" | "bottom";
  emptyText: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className={cn("rounded-md p-1", iconColor)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/80">
          {title}
        </h3>
        <span className="text-[10px] text-muted-foreground">
          {items.length > 0 && `· ${items.length} ${items.length === 1 ? "cliente" : "clientes"}`}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/50 p-4 text-center text-xs text-muted-foreground">
          {emptyText}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((s, i) => (
            <Item key={s.id} rank={i + 1} s={s} kind={kind} />
          ))}
        </ul>
      )}
    </div>
  );
}

export function RankingResumo({ top, bottom }: Props) {
  if (top.length === 0 && bottom.length === 0) {
    return (
      <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
        Nenhuma avaliação esta semana ainda.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <Column
        title="Mais satisfeitos"
        icon={TrendingUp}
        iconColor="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        items={top}
        kind="top"
        emptyText="Nenhum cliente em zona verde ainda."
      />
      <Column
        title="Menos satisfeitos"
        icon={TrendingDown}
        iconColor="bg-rose-500/10 text-rose-600 dark:text-rose-400"
        items={bottom}
        kind="bottom"
        emptyText="Nenhum cliente em zona amarela ou vermelha."
      />
    </div>
  );
}
