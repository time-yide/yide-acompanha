import { ArrowDown, ArrowUp, type LucideIcon } from "lucide-react";

interface Props {
  label: string;
  valor: string;
  delta?: { valor: string; direction: "up" | "down" | "neutral" };
  icon?: LucideIcon;
  helperText?: string;
}

export function KpiCard({ label, valor, delta, icon: Icon, helperText }: Props) {
  const deltaColor =
    delta?.direction === "up"
      ? "text-green-600 dark:text-green-400"
      : delta?.direction === "down"
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground";

  return (
    <div className="rounded-xl border bg-card p-4 space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="text-2xl font-bold tracking-tight tabular-nums">{valor}</div>
      {delta && (
        <div className={`flex items-center gap-1 text-xs ${deltaColor}`}>
          {delta.direction === "up" && <ArrowUp className="h-3 w-3" />}
          {delta.direction === "down" && <ArrowDown className="h-3 w-3" />}
          <span>{delta.valor}</span>
          {helperText && <span className="text-muted-foreground">· {helperText}</span>}
        </div>
      )}
      {!delta && helperText && (
        <div className="text-xs text-muted-foreground">{helperText}</div>
      )}
    </div>
  );
}
