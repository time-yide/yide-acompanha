import Link from "next/link";
import { Video, Lock } from "lucide-react";
import type { CalendarEvent } from "@/lib/calendario/schema";
import { formatBrtDateOnly, formatBrtTime } from "@/lib/calendario/timezone";
import { getDatePartsInAppTz, getTodayDate } from "@/lib/datetime/timezone";

const DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

// Cores por sub_calendar (versão mais discreta pra caber no bar do mês).
const subBar: Record<string, string> = {
  agencia: "bg-violet-500/80 text-white",
  onboarding: "bg-blue-500/80 text-white",
  aniversarios: "bg-pink-500/80 text-white",
  videomakers: "bg-fuchsia-500 text-white shadow-sm",
  assessores: "bg-amber-500/80 text-white",
  coordenadores: "bg-orange-500/80 text-white",
};

interface Props {
  /** Início da grade (segunda da 1ª linha), em UTC. */
  gridStart: Date;
  /** Mês de referência (1-12) - células fora desse mês ficam atenuadas. */
  refMonth: number;
  events: CalendarEvent[];
}

const MAX_PER_CELL = 3;

export function MonthView({ gridStart, refMonth, events }: Props) {
  // YYYY-MM-DD (fuso app) → eventos do dia
  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const key = formatBrtDateOnly(e.inicio);
    const arr = byDay.get(key) ?? [];
    arr.push(e);
    byDay.set(key, arr);
  }

  // 42 células, incrementando 1 dia em UTC (Cuiabá não tem DST → seguro).
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setUTCDate(d.getUTCDate() + i);
    cells.push(d);
  }

  const todayYmd = getTodayDate();

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      {/* Header dos dias da semana */}
      <div className="grid grid-cols-7 border-b bg-muted/30">
        {DAYS.map((d) => (
          <div
            key={d}
            className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-center"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Grade 6×7 */}
      <div className="grid grid-cols-7 grid-rows-6">
        {cells.map((d, i) => {
          const parts = getDatePartsInAppTz(d);
          const cellYmd = `${parts.year}-${parts.month}-${parts.day}`;
          const cellMonth = parseInt(parts.month, 10);
          const dayNum = parseInt(parts.day, 10);
          const inMonth = cellMonth === refMonth;
          const isToday = cellYmd === todayYmd;
          const dayEvents = byDay.get(cellYmd) ?? [];

          // Bordas: top só na primeira linha, left só na primeira coluna
          const isFirstRow = i < 7;
          const isFirstCol = i % 7 === 0;

          return (
            <div
              key={i}
              className={[
                "min-h-[110px] p-1.5 flex flex-col gap-1",
                isFirstRow ? "" : "border-t",
                isFirstCol ? "" : "border-l",
                inMonth ? "bg-card" : "bg-muted/20",
              ].join(" ")}
            >
              {/* Cabeçalho da célula - número do dia (com bolinha primary se hoje) */}
              <div className="flex items-center justify-between">
                {isToday ? (
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground tabular-nums">
                    {dayNum}
                  </span>
                ) : (
                  <span
                    className={[
                      "text-xs font-semibold tabular-nums px-1.5",
                      inMonth ? "text-foreground" : "text-muted-foreground/60",
                    ].join(" ")}
                  >
                    {dayNum}
                  </span>
                )}
              </div>

              {/* Eventos do dia */}
              <div className="flex-1 space-y-0.5 overflow-hidden">
                {dayEvents.slice(0, MAX_PER_CELL).map((e) => {
                  // Bloqueio aprovado: marcador read-only, visual neutro/tracejado.
                  if (e.bloqueio) {
                    const b = e.bloqueio;
                    return (
                      <div
                        key={e.id}
                        className="flex items-center gap-1 rounded border border-dashed border-muted-foreground/50 bg-muted/40 px-1.5 py-0.5 text-[10px] leading-tight font-medium text-muted-foreground"
                        title={`${b.hora_inicio}–${b.hora_fim} · ${b.videomaker_nome} indisponível — ${b.motivo}`}
                      >
                        <Lock className="h-2.5 w-2.5 flex-shrink-0" />
                        <span className="truncate">🔒 {b.motivo}</span>
                      </div>
                    );
                  }
                  const isVm = e.sub_calendar === "videomakers";
                  const cls = subBar[e.sub_calendar] ?? subBar.agencia;
                  const inner = (
                    <div
                      className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] leading-tight font-medium ${cls}`}
                      title={`${formatBrtTime(e.inicio)} · ${e.titulo}`}
                    >
                      {isVm && <Video className="h-2.5 w-2.5 flex-shrink-0" />}
                      <span className="tabular-nums opacity-90">
                        {formatBrtTime(e.inicio)}
                      </span>
                      <span className="truncate">{e.titulo}</span>
                    </div>
                  );
                  return e.link ? (
                    <Link key={e.id} href={e.link} className="block">
                      {inner}
                    </Link>
                  ) : (
                    <div key={e.id}>{inner}</div>
                  );
                })}
                {dayEvents.length > MAX_PER_CELL && (
                  <Link
                    href={`/calendario?week=${cellYmd}`}
                    className="block px-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:underline"
                  >
                    + {dayEvents.length - MAX_PER_CELL} mais
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const MONTHS_BR = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

/** Nome longo do mês em pt-BR - ex.: "Maio de 2026". */
export function formatMonthLabel(year: number, month: number): string {
  return `${MONTHS_BR[month - 1]} de ${year}`;
}
