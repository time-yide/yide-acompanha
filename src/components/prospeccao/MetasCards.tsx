import type { MetaItem, MetasComercialData } from "@/lib/prospeccao/queries";

interface Props {
  metas: MetasComercialData;
}

function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

const STATUS_FILL: Record<MetaItem["status"], string> = {
  abaixo: "bg-muted-foreground/40",
  "no-caminho": "bg-amber-500",
  perto: "bg-primary",
  atingido: "bg-green-600",
};

const STATUS_LABEL: Record<MetaItem["status"], string> = {
  abaixo: "Início do mês",
  "no-caminho": "No caminho",
  perto: "Quase lá",
  atingido: "Meta atingida",
};

interface CardProps {
  title: string;
  meta: MetaItem;
  formatValue: (v: number) => string;
}

function Card({ title, meta, formatValue }: CardProps) {
  const pctClamped = Math.min(meta.pctMeta, 100);
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-[10px] font-medium text-muted-foreground">{STATUS_LABEL[meta.status]}</span>
      </div>

      <div>
        <div className="text-2xl font-bold tracking-tight tabular-nums">{formatValue(meta.realizado)}</div>
        <div className="text-xs text-muted-foreground">
          Meta: {formatValue(meta.meta)} · {meta.pctMeta.toFixed(0)}% atingido
        </div>
      </div>

      <div className="h-3 rounded-full bg-muted overflow-hidden">
        <div className={`h-full transition-all ${STATUS_FILL[meta.status]}`} style={{ width: `${pctClamped}%` }} />
      </div>

      <div className="text-[11px] text-muted-foreground">
        {meta.configurada ? "Configurada pelo sócio" : "Automática (3× fixo)"}
      </div>
    </div>
  );
}

export function MetasCards({ metas }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Card title="Prospects abordados" meta={metas.prospects} formatValue={(v) => String(v)} />
      <Card title="Fechamentos do mês" meta={metas.fechamentos} formatValue={(v) => String(v)} />
      <Card title="Receita do mês" meta={metas.receita} formatValue={formatBRL} />
    </div>
  );
}
