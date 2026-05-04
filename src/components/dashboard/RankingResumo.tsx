import Link from "next/link";
import { SatisfactionSparkline } from "@/components/satisfacao/SatisfactionSparkline";
import type { SynthesisRowWithCliente } from "@/lib/dashboard/queries";
import { cn } from "@/lib/utils";

interface Props {
  top: SynthesisRowWithCliente[];
  bottom: SynthesisRowWithCliente[];
}

function medal(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
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
        className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300"
      >
        completo
      </span>
    );
  }
  return (
    <span
      title={`${votos}/${esperados} avaliadores responderam · ranking ainda em formação`}
      className="inline-flex items-center gap-1 rounded-full border border-sky-500/40 bg-sky-500/10 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-300"
    >
      <span className="h-1 w-1 animate-pulse rounded-full bg-sky-500" />
      em curso · {votos}/{esperados}
    </span>
  );
}

function Item({ rank, s }: { rank: number; s: SynthesisRowWithCliente }) {
  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-2 text-sm",
        s.status === "em_curso" && "opacity-90",
      )}
    >
      <span className="font-bold w-6 text-center">{medal(rank)}</span>
      <Link href={`/clientes/${s.client_id}/satisfacao`} className="flex-1 min-w-0 truncate hover:underline">
        {s.cliente?.nome ?? "—"}
      </Link>
      <StatusBadge status={s.status} votos={s.votos_atuais} esperados={s.votos_esperados} />
      <SatisfactionSparkline clientId={s.client_id} />
      <span className="font-semibold tabular-nums w-10 text-right">{Number(s.score_final).toFixed(1)}</span>
    </li>
  );
}

export function RankingResumo({ top, bottom }: Props) {
  if (top.length === 0 && bottom.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">Nenhuma avaliação esta semana ainda.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-green-600 dark:text-green-400">
          Mais satisfeitos
        </h3>
        {top.length === 0 ? (
          <p className="text-xs text-muted-foreground">—</p>
        ) : (
          <ul className="space-y-2">
            {top.map((s, i) => <Item key={s.id} rank={i + 1} s={s} />)}
          </ul>
        )}
      </div>
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">
          Menos satisfeitos
        </h3>
        {bottom.length === 0 ? (
          <p className="text-xs text-muted-foreground">—</p>
        ) : (
          <ul className="space-y-2">
            {bottom.map((s, i) => <Item key={s.id} rank={i + 1} s={s} />)}
          </ul>
        )}
      </div>
    </div>
  );
}
