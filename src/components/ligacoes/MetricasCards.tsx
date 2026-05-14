import {
  Phone, PhoneCall, PhoneMissed, PhoneOff, Clock, Users, MessageCircle, TrendingUp, TrendingDown,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatDuracao } from "@/lib/ligacoes/tipos";
import type { MetricasGerais } from "@/lib/ligacoes/queries";

export function MetricasCards({ m }: { m: MetricasGerais }) {
  const taxaAtendimento = m.total > 0 ? Math.round((m.atendidas / m.total) * 1000) / 10 : 0;
  const taxaPerda = m.total > 0 ? Math.round((m.perdidas / m.total) * 1000) / 10 : 0;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <KpiCard
        icon={Phone}
        label="Total"
        value={m.total.toLocaleString("pt-BR")}
        subtitle={
          m.variacao_total_pct !== null
            ? `${m.variacao_total_pct > 0 ? "+" : ""}${m.variacao_total_pct.toFixed(1)}% vs anterior`
            : ""
        }
        trend={m.variacao_total_pct}
        tone="from-blue-500/20 to-blue-500/5 border-blue-500/30"
        iconTone="text-blue-500"
      />
      <KpiCard
        icon={PhoneCall}
        label="Atendidas"
        value={m.atendidas.toLocaleString("pt-BR")}
        subtitle={`${taxaAtendimento}% do total`}
        tone="from-emerald-500/20 to-emerald-500/5 border-emerald-500/30"
        iconTone="text-emerald-500"
        progress={taxaAtendimento}
      />
      <KpiCard
        icon={PhoneMissed}
        label="Perdidas"
        value={m.perdidas.toLocaleString("pt-BR")}
        subtitle={`${taxaPerda}% do total`}
        tone="from-amber-500/20 to-amber-500/5 border-amber-500/30"
        iconTone="text-amber-500"
        progress={taxaPerda}
        progressTone="bg-amber-500"
      />
      <KpiCard
        icon={PhoneOff}
        label="Rejeitadas / Outras"
        value={(m.rejeitadas + m.outras).toLocaleString("pt-BR")}
        subtitle={`${m.rejeitadas} rejeitadas`}
        tone="from-rose-500/20 to-rose-500/5 border-rose-500/30"
        iconTone="text-rose-500"
      />
      <KpiCard
        icon={Clock}
        label="Tempo médio"
        value={formatDuracao(m.duracao_media_seg)}
        subtitle={`Total: ${formatDuracao(m.duracao_total_seg)}`}
        tone="from-violet-500/20 to-violet-500/5 border-violet-500/30"
        iconTone="text-violet-500"
      />
      <KpiCard
        icon={Users}
        label="Números únicos"
        value={m.clientes_unicos.toLocaleString("pt-BR")}
        subtitle={
          <span className="flex items-center gap-1">
            <Phone className="h-2.5 w-2.5 text-blue-500" /> {m.por_tipo.telefone}
            <span className="mx-1">·</span>
            <MessageCircle className="h-2.5 w-2.5 text-emerald-500" /> {m.por_tipo.whatsapp}
          </span>
        }
        tone="from-cyan-500/20 to-cyan-500/5 border-cyan-500/30"
        iconTone="text-cyan-500"
      />
    </div>
  );
}

interface KpiCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subtitle: React.ReactNode;
  tone: string;
  iconTone: string;
  trend?: number | null;
  progress?: number;
  progressTone?: string;
}

function KpiCard({
  icon: Icon, label, value, subtitle, tone, iconTone, trend, progress, progressTone,
}: KpiCardProps) {
  return (
    <Card className={`relative overflow-hidden border bg-gradient-to-br p-4 transition-transform hover:scale-[1.02] ${tone}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
        <Icon className={`h-4 w-4 ${iconTone}`} />
      </div>
      <p className="mt-2 text-3xl font-bold tabular-nums leading-tight">{value}</p>
      <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
        {typeof trend === "number" && trend !== 0 && (
          trend > 0 ? <TrendingUp className="h-3 w-3 text-emerald-500" /> : <TrendingDown className="h-3 w-3 text-rose-500" />
        )}
        <span className="truncate">{subtitle}</span>
      </div>
      {progress !== undefined && progress > 0 && (
        <div className="mt-2 h-1 w-full rounded-full bg-background/40">
          <div
            className={`h-1 rounded-full ${progressTone ?? "bg-emerald-500"}`}
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
      )}
    </Card>
  );
}
