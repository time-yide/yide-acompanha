import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { Trend } from "@/lib/calendario/temperatura";

export function Tendencia({ trend }: { trend: Trend }) {
  const Icon = trend.direction === "up" ? TrendingUp : trend.direction === "down" ? TrendingDown : Minus;
  const color =
    trend.direction === "up"
      ? "text-emerald-600"
      : trend.direction === "down"
        ? "text-amber-600"
        : "text-muted-foreground";
  return (
    <Card className="space-y-2 p-4">
      <h3 className="text-sm font-semibold">Tendência</h3>
      <div className={`flex items-center gap-2 ${color}`}>
        <Icon className="h-5 w-5" />
        <span className="text-2xl font-bold tabular-nums">{trend.current}</span>
        <span className="text-xs">
          {trend.deltaPct > 0 ? "+" : ""}
          {trend.deltaPct}% vs. média ({Math.round(trend.avgPrevious * 10) / 10})
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground">Eventos deste período vs. média dos 4 anteriores.</p>
    </Card>
  );
}
