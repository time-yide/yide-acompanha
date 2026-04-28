interface Props {
  filled: number;
  total: number;
}

export function ProgressBar({ filled, total }: Props) {
  const pct = total === 0 ? 0 : Math.round((filled / total) * 100);
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">
        Você avaliou {filled} de {total} clientes esta semana ({pct}%)
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
