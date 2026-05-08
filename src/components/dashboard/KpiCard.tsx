import { ArrowDown, ArrowUp, type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

interface Props {
  label: string;
  /** Aceita ReactNode pra suportar <Money> (que esconde valor sob toggle). */
  valor: ReactNode;
  delta?: { valor: ReactNode; direction: "up" | "down" | "neutral" };
  icon?: LucideIcon;
  helperText?: ReactNode;
}

export function KpiCard({ label, valor, delta, icon: Icon, helperText }: Props) {
  const deltaColor =
    delta?.direction === "up"
      ? "text-green-600 dark:text-green-400"
      : delta?.direction === "down"
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground";

  return (
    <div className="rounded-xl border bg-card p-3 space-y-1 sm:p-4">
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground sm:text-xs">{label}</span>
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground sm:h-4 sm:w-4" />}
      </div>
      <div className="text-lg font-bold tracking-tight tabular-nums sm:text-2xl">{valor}</div>
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
