import type { RankingRow } from "@/lib/academy/queries";

interface Props {
  ranking: RankingRow[];
  currentUserId: string;
}

const MEDAL_TONE = [
  "bg-amber-500/15 text-amber-700 dark:text-amber-400 ring-amber-500/30",
  "bg-slate-400/15 text-slate-700 dark:text-slate-300 ring-slate-400/30",
  "bg-orange-700/15 text-orange-800 dark:text-orange-400 ring-orange-700/30",
];

export function RankingPanel({ ranking, currentUserId }: Props) {
  // Top 5 sempre aparece
  const top = ranking.slice(0, 5);
  const meuIndex = ranking.findIndex((r) => r.participante_id === currentUserId);
  // Se não estou no top 5 mas tenho posição, mostra também ali embaixo
  const showMeBelow = meuIndex >= 5;

  if (ranking.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Ninguém aprovou em nenhum treinamento ainda. Seja o primeiro!
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {top.map((r, i) => (
        <RankRow
          key={r.participante_id}
          posicao={i + 1}
          row={r}
          isMe={r.participante_id === currentUserId}
        />
      ))}
      {showMeBelow && (
        <>
          <div className="my-2 text-center text-[10px] uppercase tracking-wider text-muted-foreground">
            ···
          </div>
          <RankRow posicao={meuIndex + 1} row={ranking[meuIndex]} isMe />
        </>
      )}
    </div>
  );
}

function RankRow({ posicao, row, isMe }: { posicao: number; row: RankingRow; isMe: boolean }) {
  const tone = MEDAL_TONE[posicao - 1];
  return (
    <div
      className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs ${
        isMe ? "bg-primary/10 ring-1 ring-primary/30" : ""
      }`}
    >
      <span
        className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
          tone ? `ring-1 ${tone}` : "bg-muted text-muted-foreground"
        }`}
      >
        {posicao}
      </span>
      <span className={`flex-1 truncate ${isMe ? "font-semibold" : "font-medium"}`}>
        {row.nome}
        {isMe && <span className="ml-1 text-[10px] text-primary">(você)</span>}
      </span>
      <span className="text-[11px] tabular-nums text-muted-foreground">
        {row.pontos} pts
      </span>
    </div>
  );
}
