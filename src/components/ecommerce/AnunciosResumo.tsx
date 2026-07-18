import { Boxes, Package, Users, Store } from "lucide-react";
import { marketplaceLabel, marketplaceStyle } from "@/lib/ecommerce/marketplaces";
import type { EcommerceAggregate } from "@/lib/ecommerce/aggregate";

interface Props {
  agg: EcommerceAggregate;
  lancamentos: number;
}

/** Resumo do período no topo da aba Lançamentos — dá contexto antes da lista. */
export function AnunciosResumo({ agg, lancamentos }: Props) {
  const cards = [
    { label: "Anúncios no período", value: agg.kpis.total, icon: Boxes, destaque: true },
    { label: "Lançamentos", value: lancamentos, icon: Package, destaque: false },
    { label: "Clientes", value: agg.kpis.clientes, icon: Users, destaque: false },
    { label: "Marketplaces", value: agg.porMarketplace.length, icon: Store, destaque: false },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.label}
              className={`relative overflow-hidden rounded-xl border p-4 ${
                c.destaque
                  ? "border-primary/30 bg-gradient-to-br from-primary/10 to-transparent"
                  : "bg-card"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:text-xs">
                  {c.label}
                </p>
                <Icon className={`h-4 w-4 ${c.destaque ? "text-primary" : "text-muted-foreground/70"}`} />
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums sm:text-3xl">
                {c.value.toLocaleString("pt-BR")}
              </p>
            </div>
          );
        })}
      </div>

      {agg.porMarketplace.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {agg.porMarketplace.map((m) => {
            const s = marketplaceStyle(m.marketplace);
            return (
              <span
                key={m.marketplace}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${s.pill}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${s.bar}`} />
                {marketplaceLabel(m.marketplace)}
                <span className="tabular-nums opacity-70">{m.total}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
