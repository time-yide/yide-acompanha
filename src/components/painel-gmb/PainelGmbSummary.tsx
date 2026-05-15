import { Star, MessageCircle, TrendingUp, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { PainelGmbSummary } from "@/lib/painel-gmb/queries";

interface Props {
  summary: PainelGmbSummary;
}

export function PainelGmbSummaryCards({ summary }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
      <KpiCard
        icon={<Star className="h-4 w-4 fill-current" />}
        label="Nota média"
        value={summary.notaMedia !== null ? summary.notaMedia.toFixed(2) : "—"}
        suffix={summary.notaMedia !== null ? "/ 5" : undefined}
        accent="amber"
      />
      <KpiCard
        icon={<MessageCircle className="h-4 w-4" />}
        label="Total de reviews"
        value={summary.totalReviews.toLocaleString("pt-BR")}
        helper={`${summary.totalMonitorados} clientes`}
        accent="primary"
      />
      <KpiCard
        icon={<TrendingUp className="h-4 w-4" />}
        label="Melhoraram"
        value={summary.melhoraram30d.toString()}
        helper="últimos 30 dias"
        accent="emerald"
      />
      <KpiCard
        icon={<TrendingDown className="h-4 w-4" />}
        label="Pioraram"
        value={summary.pioraram30d.toString()}
        helper="últimos 30 dias"
        accent="rose"
      />
    </div>
  );
}

interface KpiProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  suffix?: string;
  helper?: string;
  accent: "amber" | "primary" | "emerald" | "rose";
}

function KpiCard({ icon, label, value, suffix, helper, accent }: KpiProps) {
  const accentClasses = {
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  }[accent];
  return (
    <Card className="p-3 sm:p-4">
      <div className={`flex h-7 w-7 items-center justify-center rounded-md ${accentClasses}`}>
        {icon}
      </div>
      <div className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-2xl font-bold tabular-nums sm:text-3xl">{value}</span>
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </div>
      {helper && (
        <div className="mt-1 text-[11px] text-muted-foreground">{helper}</div>
      )}
    </Card>
  );
}
