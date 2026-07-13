"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { toggleStoryDayAction } from "@/lib/painel/stories-actions";
import type { StoriesGridRow } from "@/lib/painel/stories-queries";
import { cn } from "@/lib/utils";

interface Props {
  rows: StoriesGridRow[];
  canEdit: boolean;
  /** "YYYY-MM-DD" de hoje no fuso da app (server-provided, evita drift de TZ). */
  todayIso: string;
}

export function StoriesMonthGrid({ rows, canEdit, todayIso }: Props) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Nenhum cliente com stories ativado nesta unidade.
      </p>
    );
  }

  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <ClientStoryRow key={r.client_id} row={r} canEdit={canEdit} todayIso={todayIso} />
      ))}
    </div>
  );
}

function ClientStoryRow({
  row,
  canEdit,
  todayIso,
}: {
  row: StoriesGridRow;
  canEdit: boolean;
  todayIso: string;
}) {
  const [posted, setPosted] = useState<Set<number>>(
    () => new Set(row.dias.filter((d) => d.postado).map((d) => d.dia)),
  );
  const [pending, startTransition] = useTransition();

  const perDay = Math.max(1, row.quantidade_diaria_stories);
  const postadosStories = posted.size * perDay;
  const pct = row.meta > 0 ? Math.min(100, (postadosStories / row.meta) * 100) : 0;

  function toggle(dia: number, data: string) {
    if (!canEdit || pending) return;
    const prev = posted;
    const next = new Set(prev);
    if (next.has(dia)) next.delete(dia);
    else next.add(dia);
    setPosted(next);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("client_id", row.client_id);
      fd.set("data", data);
      const res = await toggleStoryDayAction(fd);
      if (res.error) {
        toast.error(res.error);
        setPosted(prev);
      }
    });
  }

  return (
    <div className="rounded-xl border bg-card p-3.5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{row.client_nome}</p>
          <p className="text-xs text-muted-foreground">
            {row.quantidade_diaria_stories}/dia
            {row.assessor_nome ? ` · ${row.assessor_nome}` : ""}
          </p>
        </div>
        <p className="text-sm font-bold tabular-nums">
          {postadosStories}
          <span className="text-xs font-medium text-muted-foreground"> / {row.meta}</span>
          <span className="ml-1.5 text-xs font-medium text-primary">{Math.round(pct)}%</span>
        </p>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>

      {/* Strip de dias do mês */}
      <div className="mt-2.5 flex flex-wrap gap-1">
        {row.dias.map((d) => {
          const isPosted = posted.has(d.dia);
          const isToday = d.data === todayIso;
          const isPast = d.data < todayIso;
          const missed = !isPosted && isPast;
          return (
            <button
              key={d.dia}
              type="button"
              disabled={!canEdit || pending}
              onClick={() => toggle(d.dia, d.data)}
              title={
                isPosted
                  ? `Dia ${d.dia}: postado — clique pra desmarcar`
                  : `Dia ${d.dia}: ${missed ? "não postado (atrasado)" : "não postado"}${canEdit ? " — clique pra marcar" : ""}`
              }
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md text-[11px] font-semibold tabular-nums transition-colors",
                canEdit && !pending ? "cursor-pointer" : "cursor-default",
                isPosted
                  ? "bg-emerald-500 text-white hover:bg-emerald-600"
                  : missed
                    ? "border border-rose-500/40 bg-rose-500/5 text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
                    : "bg-muted text-muted-foreground hover:bg-muted-foreground/20",
                isToday && "ring-2 ring-primary ring-offset-1 ring-offset-background",
              )}
            >
              {d.dia}
            </button>
          );
        })}
      </div>
    </div>
  );
}
