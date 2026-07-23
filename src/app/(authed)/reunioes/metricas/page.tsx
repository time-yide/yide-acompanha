import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, Mic, Clock, Users, ListChecks, TrendingUp, Award,
} from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { getMeetingMetrics } from "@/lib/reunioes/queries";
import { MEETING_STATUS_LABEL, formatDuracao, type MeetingStatus } from "@/lib/reunioes/tipos";
import { ParticipantAvatar } from "@/components/reunioes/ParticipantAvatar";

const ALLOWED_ROLES = ["adm", "socio", "comercial", "coordenador", "assessor", "audiovisual_chefe"];

const DIAS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default async function MetricasReunioesPage() {
  const user = await requireAuth();
  if (!ALLOWED_ROLES.includes(user.role)) notFound();
  const metrics = await getMeetingMetrics(user);

  const maxRanking = Math.max(...metrics.porColaborador.map((c) => c.quantidade), 1);
  const maxDia = Math.max(...metrics.porDiaSemana.map((d) => d.total), 1);

  return (
    <div className="space-y-6">
      <Link
        href="/reunioes"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        Voltar para Reuniões
      </Link>

      <header className="space-y-1.5">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
          <TrendingUp className="h-3 w-3" />
          Inteligência da equipe
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Métricas de reuniões</h1>
        <p className="text-sm text-muted-foreground">
          Quanto tempo a equipe passa em reuniões, quem mais participa e o resultado disso (tarefas geradas).
        </p>
      </header>

      {/* KPI cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <BigKpi
          icon={Mic}
          label="Total de reuniões"
          valor={metrics.total}
          helper="No histórico"
        />
        <BigKpi
          icon={Clock}
          label="Tempo total"
          valor={formatDuracao(metrics.totalDuracaoSegundos)}
          helper="Acumulado em chamadas"
          accent="primary"
        />
        <BigKpi
          icon={Users}
          label="Colaboradores ativos"
          valor={metrics.porColaborador.length}
          helper="Participaram de ao menos 1 call"
        />
        <BigKpi
          icon={ListChecks}
          label="Tarefas geradas"
          valor={metrics.tasksGeradas}
          helper="Pela IA, no histórico"
          accent="primary"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Ranking por colaborador */}
        <section className="rounded-xl border bg-card p-5 space-y-3">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wider text-foreground/80">
            <Award className="h-3.5 w-3.5 text-amber-500" />
            Ranking: quem mais reúne
          </h2>
          {metrics.porColaborador.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
          ) : (
            <ul className="space-y-2">
              {metrics.porColaborador.slice(0, 8).map((c, idx) => (
                <li key={c.user_id} className="flex items-center gap-3">
                  <span className="w-6 shrink-0 text-center text-xs font-mono text-muted-foreground tabular-nums">
                    {idx + 1}
                  </span>
                  <ParticipantAvatar nome={c.nome} size="sm" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium">{c.nome}</span>
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        {c.quantidade} call{c.quantidade !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`absolute inset-y-0 left-0 transition-all ${
                          idx === 0 ? "bg-amber-500" : idx === 1 ? "bg-blue-500" : "bg-primary/60"
                        }`}
                        style={{ width: `${(c.quantidade / maxRanking) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="hidden sm:inline font-mono text-[10px] tabular-nums text-muted-foreground">
                    {formatDuracao(c.duracao_segundos)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Status breakdown */}
        <section className="rounded-xl border bg-card p-5 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground/80">
            Status das reuniões
          </h2>
          <ul className="space-y-2">
            {(Object.entries(metrics.porStatus) as Array<[MeetingStatus, number]>)
              .filter(([, v]) => v > 0)
              .sort(([, a], [, b]) => b - a)
              .map(([status, v]) => (
                <li key={status} className="flex items-center gap-3">
                  <span className="min-w-32 text-xs font-medium">{MEETING_STATUS_LABEL[status]}</span>
                  <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`absolute inset-y-0 left-0 ${
                        status === "in_progress"
                          ? "bg-emerald-500"
                          : status === "processing"
                            ? "bg-amber-500"
                            : status === "scheduled"
                              ? "bg-blue-500"
                              : status === "failed"
                                ? "bg-rose-500"
                                : "bg-muted-foreground/40"
                      }`}
                      style={{ width: `${(v / metrics.total) * 100}%` }}
                    />
                  </div>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">{v}</span>
                </li>
              ))}
          </ul>
        </section>
      </div>

      {/* Mapa de horários (heatmap por dia da semana) */}
      <section className="rounded-xl border bg-card p-5 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground/80">
          Mapa da semana
        </h2>
        <p className="text-xs text-muted-foreground">
          Distribuição por dia da semana, útil pra planejar quando a equipe tá mais ou menos ocupada.
        </p>
        <div className="grid grid-cols-7 gap-2 pt-1">
          {metrics.porDiaSemana.map((d) => {
            const pct = (d.total / maxDia) * 100;
            return (
              <div key={d.dia} className="flex flex-col items-center gap-1.5">
                <div className="relative flex h-24 w-full items-end overflow-hidden rounded-md border bg-muted/30">
                  <div
                    className="w-full bg-gradient-to-t from-primary to-primary/60"
                    style={{ height: `${pct}%` }}
                  />
                  {d.total > 0 && (
                    <span className="absolute inset-x-0 top-1 text-center text-[10px] font-semibold tabular-nums">
                      {d.total}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium text-muted-foreground">{DIAS_PT[d.dia]}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Top tags */}
      {metrics.topTags.length > 0 && (
        <section className="rounded-xl border bg-card p-5 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground/80">
            Tags mais frequentes
          </h2>
          <div className="flex flex-wrap gap-2">
            {metrics.topTags.map((t) => (
              <span
                key={t.tag}
                className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs"
              >
                <span className="font-medium">#{t.tag}</span>
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-mono tabular-nums text-muted-foreground">
                  {t.count}
                </span>
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function BigKpi({
  icon: Icon, label, valor, helper, accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  valor: string | number;
  helper: string;
  accent?: "primary";
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className={`h-3.5 w-3.5 ${accent === "primary" ? "text-primary" : "text-muted-foreground"}`} />
      </div>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${accent === "primary" ? "text-primary" : ""}`}>
        {valor}
      </p>
      <p className="text-[11px] text-muted-foreground">{helper}</p>
    </div>
  );
}
