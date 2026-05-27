interface Props {
  used: number;
  total: number;
}

export function YoriQuotaIndicator({ used, total }: Props) {
  const pct = total > 0 ? Math.round((used / total) * 100) : 0;
  const isWarning = pct >= 80;
  const isFull = used >= total;

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Vídeos este mês</span>
        <span className={isFull ? "font-semibold text-destructive" : isWarning ? "font-semibold text-amber-600 dark:text-amber-400" : "font-medium"}>
          {used} / {total}
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full transition-all ${
            isFull ? "bg-destructive" : isWarning ? "bg-amber-500" : "bg-primary"
          }`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      {isFull && (
        <p className="mt-2 text-[11px] text-destructive">
          Quota atingida. Reset no dia 1 do próximo mês.
        </p>
      )}
    </div>
  );
}
