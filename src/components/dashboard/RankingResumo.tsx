import Link from "next/link";
import { SatisfactionSparkline } from "@/components/satisfacao/SatisfactionSparkline";
import type { SynthesisRowWithCliente } from "@/lib/dashboard/queries";

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

function Item({ rank, s }: { rank: number; s: SynthesisRowWithCliente }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <span className="font-bold w-6 text-center">{medal(rank)}</span>
      <Link href={`/clientes/${s.client_id}/satisfacao`} className="flex-1 truncate hover:underline">
        {s.cliente?.nome ?? "—"}
      </Link>
      <SatisfactionSparkline clientId={s.client_id} />
      <span className="font-semibold tabular-nums w-10 text-right">{Number(s.score_final).toFixed(1)}</span>
    </li>
  );
}

export function RankingResumo({ top, bottom }: Props) {
  if (top.length === 0 && bottom.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">Sem sínteses disponíveis ainda.</p>;
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
