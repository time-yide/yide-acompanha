import { Trophy, TrendingUp } from "lucide-react";
import type { MetaComercial } from "@/lib/dashboard/comercial-queries";

interface Props {
  meta: MetaComercial;
}

function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

const STATUS_FILL: Record<MetaComercial["status"], string> = {
  abaixo: "bg-muted-foreground/40",
  "no-caminho": "bg-amber-500",
  perto: "bg-primary",
  atingido: "bg-green-600",
};

const STATUS_LABEL: Record<MetaComercial["status"], string> = {
  abaixo: "Início do mês",
  "no-caminho": "No caminho",
  perto: "Quase lá",
  atingido: "Meta atingida",
};

export function MetaTracker({ meta }: Props) {
  const pctClamped = Math.min(meta.pctMeta, 100);
  const Icon = meta.status === "atingido" ? Trophy : TrendingUp;
  const restanteFechamento = Math.max(0, meta.metaFechamento - meta.fechadoMes);
  const restanteComissao = restanteFechamento * (meta.metaFechamento > 0 ? meta.metaComissao / meta.metaFechamento : 0);

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Icon className={`h-5 w-5 mt-0.5 ${meta.status === "atingido" ? "text-green-600" : "text-primary"}`} />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold tracking-tight">Meta do mês</h3>
          <p className="text-xs text-muted-foreground">
            Fechar {formatBRL(meta.metaFechamento)} ≈ {formatBRL(meta.metaComissao)} em comissão
          </p>
        </div>
        <span className="text-xs font-medium text-muted-foreground">{STATUS_LABEL[meta.status]}</span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-semibold tabular-nums">{formatBRL(meta.fechadoMes)}</span>
          <span className="text-xs text-muted-foreground tabular-nums">{meta.pctMeta.toFixed(0)}% da meta</span>
        </div>
        <div className="h-3 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full transition-all ${STATUS_FILL[meta.status]}`}
            style={{ width: `${pctClamped}%` }}
          />
        </div>
      </div>

      <div className="text-xs">
        {meta.status === "atingido" ? (
          <p className="text-green-700 dark:text-green-400 font-medium">
            🎉 Meta atingida! Você já garantiu {formatBRL(meta.comissaoAtual)} de comissão variável este mês.
          </p>
        ) : (
          <p className="text-muted-foreground">
            Faltam {formatBRL(restanteFechamento)} → mais {formatBRL(restanteComissao)} de comissão se atingir.
          </p>
        )}
      </div>
    </div>
  );
}
