import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { TemperaturaSection } from "@/components/calendario/temperatura/TemperaturaSection";
import { getPeriodRange, type TempPeriod } from "@/lib/calendario/temperatura";
import { buttonVariants } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { APP_TIMEZONE, formatIsoDate } from "@/lib/datetime/timezone";

const PERIODS: { key: TempPeriod; label: string }[] = [
  { key: "week", label: "Semana" },
  { key: "month", label: "Mês" },
  { key: "quarter", label: "Trimestre" },
];

/** Rótulo do intervalo atual, ex.: "01 – 31 jul 2026" (fim inclusivo). */
function formatRangeLabel(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  // end é exclusivo (00:00 do dia seguinte ao fim) → subtrai 1ms pro dia final.
  const lastDay = new Date(new Date(endIso).getTime() - 1);
  const startFmt = start.toLocaleDateString("pt-BR", {
    timeZone: APP_TIMEZONE,
    day: "2-digit",
    month: "short",
  });
  const endFmt = lastDay.toLocaleDateString("pt-BR", {
    timeZone: APP_TIMEZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return `${startFmt} – ${endFmt}`;
}

export default async function TemperaturaPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; ref?: string }>;
}) {
  const user = await requireAuth();
  if (!canAccess(user.role, "view:agenda_temperature")) {
    redirect("/calendario");
  }

  const params = await searchParams;
  const period: TempPeriod =
    params.period === "month" || params.period === "quarter" ? params.period : "week";

  // Anchor ao meio-dia UTC (= 8h Cuiabá) pra que o dia local case em qualquer
  // fuso ocidental — mesmo cuidado da página do calendário.
  const refDate = params.ref ? new Date(`${params.ref}T12:00:00Z`) : new Date();

  const range = getPeriodRange(period, refDate);

  // Navegação: período vizinho via getPeriodRange (robusto pra mês/trimestre).
  const prevRefIso = formatIsoDate(new Date(range.start.getTime() - 1));
  const nextRefIso = formatIsoDate(range.end); // range.end = 1º instante do próximo período

  const buildHref = (p: TempPeriod, ref: string) =>
    `/calendario/temperatura?period=${p}&ref=${ref}`;

  const currentRefIso = formatIsoDate(range.start);
  const prevHref = buildHref(period, prevRefIso);
  const nextHref = buildHref(period, nextRefIso);
  const rangeLabel = formatRangeLabel(range.start.toISOString(), range.end.toISOString());

  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">🌡️ Temperatura de agenda</h1>
            <p className="text-sm text-muted-foreground">
              {rangeLabel} · visível só para coordenação
            </p>
          </div>
          <Link
            href="/calendario"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            ← Voltar ao calendário
          </Link>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Seletor de período */}
          <div className="flex items-center gap-1">
            {PERIODS.map(({ key, label }) => (
              <Link
                key={key}
                href={buildHref(key, currentRefIso)}
                className={buttonVariants({
                  variant: key === period ? "default" : "outline",
                  size: "sm",
                })}
              >
                {label}
              </Link>
            ))}
          </div>

          {/* Navegação ← → */}
          <div className="flex items-center gap-2">
            <Link
              href={prevHref}
              className={buttonVariants({ variant: "outline", size: "sm" })}
              aria-label="Período anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <Link
              href={buildHref(period, formatIsoDate(new Date()))}
              className={buttonVariants({ variant: "default", size: "sm" })}
            >
              Hoje
            </Link>
            <Link
              href={nextHref}
              className={buttonVariants({ variant: "outline", size: "sm" })}
              aria-label="Próximo período"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <TemperaturaSection coordinatorId={user.id} refDate={refDate} period={period} />
    </div>
  );
}
