"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_DEFS, REDE_BY_VALUE } from "@/lib/social-media/tipos";
import type { SocialPostRow } from "@/lib/social-media/queries";
import { APP_TIMEZONE } from "@/lib/datetime/timezone";

interface Props {
  posts: SocialPostRow[];
  /** Callback ao clicar num dia vazio (ou no botão "+ post"). */
  onCreateForDate: (date: string) => void;
  /** Callback ao clicar num post existente (abre edit). */
  onEditPost: (post: SocialPostRow) => void;
  canManage: boolean;
}

/** Retorna primeiro dia do mês como Date (timezone local). */
function firstDayOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1);
}

/** YYYY-MM-DD da Date local. */
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function CalendarMonthView({ posts, onCreateForDate, onEditPost, canManage }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed

  const todayYmd = ymd(today);

  // Agrupa posts por YYYY-MM-DD da agendar_para (ou created_at se não tem)
  const postsByDay = useMemo(() => {
    const map = new Map<string, SocialPostRow[]>();
    for (const p of posts) {
      const dateStr = p.agendar_para
        ? ymd(new Date(p.agendar_para))
        : ymd(new Date(p.created_at));
      const arr = map.get(dateStr) ?? [];
      arr.push(p);
      map.set(dateStr, arr);
    }
    return map;
  }, [posts]);

  // Constrói grid de 6 semanas x 7 dias
  const grid = useMemo(() => {
    const first = firstDayOfMonth(year, month);
    const startWeekday = first.getDay(); // 0=Sun
    const cells: { date: Date; inMonth: boolean }[] = [];

    // Dias do mês anterior pra preencher
    for (let i = startWeekday - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      cells.push({ date: d, inMonth: false });
    }

    // Dias do mês atual
    const lastDay = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= lastDay; day++) {
      cells.push({ date: new Date(year, month, day), inMonth: true });
    }

    // Preenche o resto da última semana
    while (cells.length % 7 !== 0) {
      const d = new Date(year, month, lastDay + (cells.length - startWeekday - lastDay) + 1);
      cells.push({ date: d, inMonth: false });
    }

    // Garante 6 linhas (42 cells) pra altura constante
    while (cells.length < 42) {
      const last = cells[cells.length - 1];
      const next = new Date(last.date);
      next.setDate(next.getDate() + 1);
      cells.push({ date: next, inMonth: false });
    }

    return cells;
  }, [year, month]);

  function prevMonth() {
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else {
      setMonth((m) => m - 1);
    }
  }
  function nextMonth() {
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else {
      setMonth((m) => m + 1);
    }
  }
  function goToday() {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={prevMonth}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-card hover:bg-muted"
            title="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-card hover:bg-muted"
            title="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="ml-2 inline-flex h-8 items-center rounded-md border bg-card px-3 text-xs hover:bg-muted"
          >
            Hoje
          </button>
        </div>
        <h2 className="text-lg font-semibold">
          {MESES[month]} {year}
        </h2>
        <div className="w-[160px]" />
      </div>

      {/* Grid header — dias da semana */}
      <div className="grid grid-cols-7 gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="text-center py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Grid de células */}
      <div className="grid grid-cols-7 gap-1">
        {grid.map((cell, idx) => {
          const cellYmd = ymd(cell.date);
          const dayPosts = postsByDay.get(cellYmd) ?? [];
          const isToday = cellYmd === todayYmd;

          return (
            <div
              key={idx}
              className={cn(
                "min-h-[110px] rounded-md border p-1.5 flex flex-col gap-1 group",
                cell.inMonth ? "bg-card" : "bg-muted/20 opacity-60",
                isToday && "border-primary ring-1 ring-primary/50",
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn(
                  "text-xs font-semibold",
                  isToday ? "text-primary" : cell.inMonth ? "text-foreground" : "text-muted-foreground",
                )}>
                  {cell.date.getDate()}
                </span>
                {canManage && cell.inMonth && (
                  <button
                    type="button"
                    onClick={() => onCreateForDate(cellYmd)}
                    className="opacity-0 group-hover:opacity-100 inline-flex h-4 w-4 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                    title="Criar post"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Posts do dia */}
              <div className="flex-1 space-y-0.5 overflow-hidden">
                {dayPosts.slice(0, 3).map((p) => (
                  <CalendarPostChip key={p.id} post={p} onClick={() => onEditPost(p)} />
                ))}
                {dayPosts.length > 3 && (
                  <button
                    type="button"
                    onClick={() => onEditPost(dayPosts[3])}
                    className="block w-full text-left text-[9px] text-muted-foreground hover:underline"
                  >
                    + {dayPosts.length - 3} mais
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CalendarPostChip({ post, onClick }: { post: SocialPostRow; onClick: () => void }) {
  const statusDef = STATUS_DEFS[post.status];
  const cover = post.midias[0];
  const time = post.agendar_para
    ? new Date(post.agendar_para).toLocaleTimeString("pt-BR", { timeZone: APP_TIMEZONE, hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-1 rounded border px-1 py-0.5 text-left transition-colors hover:opacity-80",
        statusDef?.color ?? "border-border bg-muted/30",
      )}
      title={`${post.titulo ?? post.legenda ?? "Sem título"} — ${statusDef?.label ?? post.status}`}
    >
      {cover && !cover.match(/\.(mp4|mov|webm)$/i) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover} alt="" className="h-5 w-5 rounded object-cover shrink-0" />
      )}
      <span className="flex-1 truncate text-[9px] font-medium leading-tight">
        {time && <span className="font-bold">{time}</span>}{time && " "}
        {post.titulo ?? post.legenda?.slice(0, 30) ?? "Sem texto"}
      </span>
      <div className="flex shrink-0 gap-0.5">
        {post.redes.slice(0, 2).map((r) => {
          const def = REDE_BY_VALUE[r];
          if (!def) return null;
          return (
            <span
              key={r}
              className={cn("inline-block h-1.5 w-1.5 rounded-full", def.color.split(" ")[1] ?? "bg-current")}
              title={def.label}
            />
          );
        })}
      </div>
    </button>
  );
}
