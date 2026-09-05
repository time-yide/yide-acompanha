import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarCog,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Clock,
  FileText,
} from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { getClientIdsForActiveUnit } from "@/lib/units/filter-helpers";
import { listAllCalendarsForMonth } from "@/lib/content-calendar/queries";
import type { CalendarStatus } from "@/lib/content-calendar/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TabsSocialMedia } from "@/components/social-media/TabsSocialMedia";

const ALLOWED_ROLES = [
  "adm",
  "socio",
  "coordenador",
  "assessor",
];

const STATUS_CONFIG: Record<
  CalendarStatus,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive"; Icon: typeof CheckCircle2 }
> = {
  pendente_geracao: { label: "Pendente", variant: "outline", Icon: Clock },
  gerando: { label: "Gerando...", variant: "secondary", Icon: Loader2 },
  gerado: { label: "Gerado", variant: "default", Icon: FileText },
  aprovado: { label: "Aprovado", variant: "default", Icon: CheckCircle2 },
  erro: { label: "Erro", variant: "destructive", Icon: AlertTriangle },
};

const PACOTE_LABELS: Record<string, string> = {
  trafego_estrategia: "Tráfego + Estratégia",
  trafego: "Tráfego",
  estrategia: "Estratégia",
  yide_360: "Yide 360°",
};

function getDefaultMonth(): string {
  const now = new Date();
  const day = now.getDate();
  if (day > 3) {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(mes: string): string {
  const [year, month] = mes.split("-").map(Number);
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function adjacentMonth(mes: string, direction: -1 | 1): string {
  const [year, month] = mes.split("-").map(Number);
  const d = new Date(year, month - 1 + direction, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function CronogramaIAPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const user = await requireAuth();
  if (!ALLOWED_ROLES.includes(user.role)) notFound();

  const params = await searchParams;
  const mes = params.mes || getDefaultMonth();
  const clientIds = await getClientIdsForActiveUnit();
  const calendars = await listAllCalendarsForMonth(mes, clientIds);

  const countByStatus = calendars.reduce(
    (acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const prevMonth = adjacentMonth(mes, -1);
  const nextMonth = adjacentMonth(mes, 1);

  return (
    <div className="space-y-5">
      <TabsSocialMedia active="cronograma-ia" />

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <CalendarCog className="h-6 w-6 text-primary" />
            Cronograma IA
          </h1>
          <p className="text-sm text-muted-foreground">
            Visão geral dos cronogramas gerados automaticamente para cada cliente.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <KpiTile label="Total" value={calendars.length} />
          <KpiTile label="Aprovados" value={countByStatus.aprovado ?? 0} accent="emerald" />
          <KpiTile label="Gerados" value={countByStatus.gerado ?? 0} accent="blue" />
          <KpiTile label="Pendentes" value={(countByStatus.pendente_geracao ?? 0) + (countByStatus.gerando ?? 0)} accent="amber" />
          {(countByStatus.erro ?? 0) > 0 && (
            <KpiTile label="Erros" value={countByStatus.erro ?? 0} accent="red" />
          )}
        </div>
      </header>

      {/* Month navigation */}
      <nav className="flex items-center gap-2">
        <Link
          href={`/social-media/cronograma-ia?mes=${prevMonth}`}
          className="rounded-md border bg-card px-3 py-1.5 text-sm hover:bg-muted"
        >
          &larr; {formatMonthLabel(prevMonth)}
        </Link>
        <span className="min-w-[160px] text-center text-sm font-semibold capitalize">
          {formatMonthLabel(mes)}
        </span>
        <Link
          href={`/social-media/cronograma-ia?mes=${nextMonth}`}
          className="rounded-md border bg-card px-3 py-1.5 text-sm hover:bg-muted"
        >
          {formatMonthLabel(nextMonth)} &rarr;
        </Link>
      </nav>

      {calendars.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nenhum cronograma encontrado para {formatMonthLabel(mes)}.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {calendars.map((cal) => {
            const cfg = STATUS_CONFIG[cal.status];
            const StatusIcon = cfg.Icon;
            return (
              <Link
                key={cal.id}
                href={`/social-media/${cal.client_id}?tab=cronograma`}
                className="group block rounded-lg border bg-card p-4 transition-colors hover:border-primary hover:bg-muted/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <h3 className="truncate font-semibold leading-tight">
                      {cal.client_nome}
                    </h3>
                    <Badge variant="secondary" className="text-[10px]">
                      {PACOTE_LABELS[cal.tipo_pacote] ?? cal.tipo_pacote}
                    </Badge>
                  </div>
                  <Badge variant={cfg.variant} className="shrink-0 gap-1">
                    <StatusIcon
                      className={`h-3 w-3 ${cal.status === "gerando" ? "animate-spin" : ""}`}
                    />
                    {cfg.label}
                  </Badge>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="tabular-nums">
                    {cal.posts_count} {cal.posts_count === 1 ? "post" : "posts"}
                  </span>
                  <span className="capitalize">
                    {cal.modo === "completo" ? "Completo" : "Leve"}
                  </span>
                  {cal.aprovado_em && (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      Aprovado em{" "}
                      {new Date(cal.aprovado_em).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                  {cal.status === "erro" && cal.erro_msg && (
                    <span className="text-destructive" title={cal.erro_msg}>
                      {cal.erro_msg.length > 40
                        ? cal.erro_msg.slice(0, 40) + "..."
                        : cal.erro_msg}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function KpiTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "emerald" | "blue" | "amber" | "red";
}) {
  const accentClass =
    accent === "emerald"
      ? "text-emerald-600 dark:text-emerald-400"
      : accent === "blue"
        ? "text-blue-600 dark:text-blue-400"
        : accent === "amber"
          ? "text-amber-600 dark:text-amber-400"
          : accent === "red"
            ? "text-red-600 dark:text-red-400"
            : "text-foreground";
  return (
    <div className="rounded-lg border bg-card px-4 py-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={`text-xl font-bold tabular-nums ${accentClass}`}>
        {value}
      </p>
    </div>
  );
}
