import Link from "next/link";
import { SatisfactionSparkline } from "./SatisfactionSparkline";
import type { SatisfactionColor } from "@/lib/satisfacao/schema";

interface Props {
  rank: number;
  clientId: string;
  clientNome: string;
  scoreFinal: number;
  corFinal: SatisfactionColor;
  acaoSugerida: string | null;
  variant: "top" | "bottom";
}

function medal(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}

export function RankingCard({ rank, clientId, clientNome, scoreFinal, corFinal, acaoSugerida, variant }: Props) {
  const bgClass = variant === "top"
    ? "border-green-500/40 bg-green-500/5"
    : corFinal === "vermelho"
      ? "border-red-500/40 bg-red-500/5"
      : "border-amber-500/40 bg-amber-500/5";

  return (
    <div className={`rounded-lg border p-3 space-y-2 ${bgClass}`}>
      <div className="flex items-center justify-between gap-2">
        <Link href={`/clientes/${clientId}/satisfacao`} className="text-sm font-medium hover:underline truncate">
          <span className="mr-2 font-bold">{medal(rank)}</span>
          {clientNome}
        </Link>
        <span className="text-sm font-semibold tabular-nums">{Number(scoreFinal).toFixed(1)}</span>
      </div>
      <SatisfactionSparkline clientId={clientId} />
      {variant === "bottom" && acaoSugerida && (
        <p className="text-[11px] text-muted-foreground line-clamp-2">{acaoSugerida}</p>
      )}
    </div>
  );
}
