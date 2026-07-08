import { formatarDataBR } from "@/lib/ecommerce/format";
import { marketplaceLabel } from "@/lib/ecommerce/marketplaces";
import type { EcommerceAggregate } from "@/lib/ecommerce/aggregate";

interface Props {
  agg: EcommerceAggregate;
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function BarList({
  title,
  items,
}: {
  title: string;
  items: { label: string; total: number }[];
}) {
  const max = items.reduce((m, i) => Math.max(m, i.total), 0) || 1;
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem dados no período.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((i, idx) => (
            <li key={`${i.label}-${idx}`} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="truncate">{i.label}</span>
                <span className="tabular-nums font-medium">{i.total}</span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary"
                  style={{ width: `${(i.total / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PainelEcommerce({ agg }: Props) {
  const mediaDia = agg.kpis.dias > 0 ? Math.round(agg.kpis.total / agg.kpis.dias) : 0;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Total de anúncios" value={agg.kpis.total} />
        <Kpi label="Clientes atendidos" value={agg.kpis.clientes} />
        <Kpi label="Assessores ativos" value={agg.kpis.assessores} />
        <Kpi label="Média por dia" value={mediaDia} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <BarList
          title="Ranking por assessor"
          items={agg.porAssessor.map((a) => ({ label: a.nome, total: a.total }))}
        />
        <BarList
          title="Total por cliente"
          items={agg.porCliente.map((c) => ({ label: c.nome, total: c.total }))}
        />
        <BarList
          title="Por marketplace"
          items={agg.porMarketplace.map((m) => ({
            label: marketplaceLabel(m.marketplace),
            total: m.total,
          }))}
        />
        <BarList
          title="Evolução no tempo"
          items={agg.porTempo.map((t) => {
            return { label: formatarDataBR(t.data), total: t.total };
          })}
        />
      </div>
    </div>
  );
}
