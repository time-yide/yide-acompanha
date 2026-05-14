import { DollarSign, Users, TrendingUp, Target, Award } from "lucide-react";
import type { MetricCards as MetricCardsType } from "@/lib/onboarding-relatorios/queries";

interface Props {
  metricas: MetricCardsType;
}

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface CardSpec {
  key: keyof MetricCardsType;
  label: string;
  icon: typeof DollarSign;
  format: (v: number) => string;
  negativeIsBad?: boolean;
}

const CARDS: CardSpec[] = [
  { key: "cpl", label: "CPL", icon: DollarSign, format: BRL },
  { key: "cac", label: "CAC", icon: Target, format: BRL },
  {
    key: "conversao",
    label: "Conversão",
    icon: TrendingUp,
    format: (v) => `${v.toFixed(1)}%`,
  },
  {
    key: "roi",
    label: "ROI",
    icon: Award,
    format: (v) => `${v.toFixed(0)}%`,
    negativeIsBad: true,
  },
  { key: "ticket_medio", label: "Ticket médio", icon: Users, format: BRL },
];

export function MetricCards({ metricas }: Props) {
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {CARDS.map(({ key, label, icon: Icon, format, negativeIsBad }, i) => {
        const valor = metricas[key];
        const isNegative = negativeIsBad && valor !== null && valor < 0;
        return (
          <div
            key={key}
            className="animate-card-rise rounded-2xl border border-primary/20 bg-card/40 p-4 shadow-[0_0_24px_-12px] shadow-primary/40"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              <Icon className="h-3 w-3" />
              {label}
            </div>
            <div
              className={`mt-2 text-xl font-bold tabular-nums ${
                isNegative ? "text-rose-500" : "text-foreground"
              }`}
            >
              {valor === null ? "—" : format(valor)}
            </div>
          </div>
        );
      })}
    </section>
  );
}
