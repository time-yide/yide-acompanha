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

  const stats = [
    { label: "Clientes", value: total, icon: Users, iconCls: "text-muted-foreground" },
    {
      label: "Concluídos",
      value: counts.concluido,
      sub: total > 0 ? `${pctConcluido}%` : undefined,
      icon: CheckCircle2,
      iconCls: "text-emerald-500",
    },
    { label: "Em produção", value: counts.em_producao, icon: Clock, iconCls: "text-amber-500" },
    { label: "Atrasados", value: counts.atrasado, icon: AlertTriangle, iconCls: "text-rose-500" },
    { label: "Sem início", value: counts.aberto, icon: Circle, iconCls: "text-slate-400" },
  ];

  return (
    <div className="grid grid-cols-2 divide-y divide-border rounded-lg border bg-card sm:grid-cols-3 sm:divide-y-0 lg:grid-cols-5 lg:divide-x">
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <div key={s.label} className="flex items-center gap-3 px-4 py-3">
            <Icon className={`h-4 w-4 shrink-0 ${s.iconCls}`} />
            <div className="min-w-0">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold tabular-nums leading-none">{s.value}</span>
                {s.sub && <span className="text-[11px] text-muted-foreground">{s.sub}</span>}
              </div>
              <p className="mt-0.5 truncate text-[11px] uppercase tracking-wider text-muted-foreground">
                {s.label}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
