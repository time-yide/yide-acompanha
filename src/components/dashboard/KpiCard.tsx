import Link from "next/link";
import { ArrowDown, ArrowUp, type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

interface Props {
  label: string;
  /** Aceita ReactNode pra suportar <Money> (que esconde valor sob toggle). */
  valor: ReactNode;
  delta?: { valor: ReactNode; direction: "up" | "down" | "neutral" };
  icon?: LucideIcon;
  helperText?: ReactNode;
  /** Quando passado, o card vira link clicável. */
  href?: string;
  /** Quando passado (e sem href), o card vira um botão clicável que dispara isto. */
  onClick?: () => void;
}

export function KpiCard({ label, valor, delta, icon: Icon, helperText, href, onClick }: Props) {
  const deltaColor =
    delta?.direction === "up"
      ? "text-green-600 dark:text-green-400"
      : delta?.direction === "down"
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground";

  const containerClasses = `rounded-xl border bg-card p-3 space-y-1 sm:p-4 ${
    href || onClick ? "transition-colors hover:bg-muted/40 hover:border-primary/40 cursor-pointer" : ""
  }`;

  const content = (
    <>
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
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`block w-full text-left ${containerClasses}`}>
        {content}
      </button>
    );
  }

  if (href) {
    return (
      <Link href={href} className={`block ${containerClasses}`}>
        {content}
      </Link>
    );
  }

  return <div className={containerClasses}>{content}</div>;
}
