import { CheckCircle2, AlertTriangle, Clock, Circle, Users } from "lucide-react";
import { aggregateStatus } from "@/lib/painel/global-status";
import type { ChecklistRow } from "@/lib/painel/queries";

interface Props {
  checklists: ChecklistRow[];
}

export function PainelKpis({ checklists }: Props) {
  const total = checklists.length;
  const counts = aggregateStatus(checklists);
  const pctConcluido = total > 0 ? Math.round((counts.concluido / total) * 100) : 0;

  const cards = [
    {
      label: "Clientes no painel",
      value: total,
      icon: Users,
      tone: "border-border bg-card text-foreground",
      iconCls: "text-muted-foreground",
    },
    {
      label: "Concluídos",
      value: counts.concluido,
      sub: total > 0 ? `${pctConcluido}% do total` : undefined,
      icon: CheckCircle2,
      tone: "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400",
      iconCls: "text-emerald-500",
    },
    {
      label: "Em produção",
      value: counts.em_producao,
      icon: Clock,
      tone: "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400",
      iconCls: "text-amber-500",
    },
    {
      label: "Atrasados",
      value: counts.atrasado,
      icon: AlertTriangle,
      tone: "border-rose-500/30 bg-rose-500/5 text-rose-700 dark:text-rose-400",
      iconCls: "text-rose-500",
    },
    {
      label: "Sem início",
      value: counts.aberto,
      icon: Circle,
      tone: "border-slate-500/30 bg-slate-500/5 text-slate-700 dark:text-slate-400",
      iconCls: "text-slate-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div key={c.label} className={`rounded-xl border p-4 ${c.tone}`}>
            <div className="flex items-center justify-between gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <span>{c.label}</span>
              <Icon className={`h-4 w-4 ${c.iconCls}`} />
            </div>
            <p className="mt-1 text-3xl font-bold tabular-nums">{c.value}</p>
            {c.sub && <p className="text-[11px] text-muted-foreground">{c.sub}</p>}
          </div>
        );
      })}
    </div>
  );
}
