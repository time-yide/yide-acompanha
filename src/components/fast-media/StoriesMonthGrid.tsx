"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Minus, Plus, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { setStoryDayCountAction } from "@/lib/painel/stories-actions";
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
  const diaria = Math.max(1, row.quantidade_diaria_stories);

  // Quantidade postada por dia (0..diária). Inicializa do server.
  const [counts, setCounts] = useState<Record<number, number>>(() => {
    const o: Record<number, number> = {};
    for (const d of row.dias) o[d.dia] = d.postado ? Math.min(d.quantidade || 0, diaria) : 0;
    return o;
  });
  const [editing, setEditing] = useState<{ dia: number; data: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const totalPostados = Object.values(counts).reduce((s, v) => s + v, 0);
  const pct = row.meta > 0 ? Math.min(100, (totalPostados / row.meta) * 100) : 0;

  function save(dia: number, data: string, qtd: number) {
    if (!canEdit) return;
    const clamped = Math.max(0, Math.min(qtd, diaria));
    const prev = counts;
    setCounts({ ...counts, [dia]: clamped });
    startTransition(async () => {
      const fd = new FormData();
      fd.set("client_id", row.client_id);
      fd.set("data", data);
      fd.set("quantidade", String(clamped));
      const res = await setStoryDayCountAction(fd);
      if (res.error) {
        toast.error(res.error);
        setCounts(prev);
      }
    });
  }

  function onCellClick(dia: number, data: string) {
    if (!canEdit) return;
    // Diária = 1 → clique alterna direto (0↔1). Mais de 1 → abre o contador.
    if (diaria === 1) save(dia, data, counts[dia] ? 0 : 1);
    else setEditing({ dia, data });
  }

  const editCount = editing ? counts[editing.dia] ?? 0 : 0;

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
          {totalPostados}
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
          const c = counts[d.dia] ?? 0;
          const complete = c >= diaria;
          const partial = c > 0 && c < diaria;
          const isToday = d.data === todayIso;
          const isPast = d.data < todayIso;
          const missed = c === 0 && isPast;
          return (
            <button
              key={d.dia}
              type="button"
              disabled={!canEdit || pending}
              onClick={() => onCellClick(d.dia, d.data)}
              title={
                complete
                  ? `Dia ${d.dia}: completo (${c}/${diaria})`
                  : partial
                    ? `Dia ${d.dia}: ${c}/${diaria} feitos`
                    : `Dia ${d.dia}: ${missed ? "não postado (atrasado)" : "não postado"}${canEdit ? " — clique pra marcar" : ""}`
              }
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md text-[11px] font-semibold tabular-nums transition-colors",
                canEdit && !pending ? "cursor-pointer" : "cursor-default",
                complete
                  ? "bg-emerald-500 text-white hover:bg-emerald-600"
                  : partial
                    ? "bg-amber-400/90 text-amber-950 hover:bg-amber-400"
                    : missed
                      ? "border border-rose-500/40 bg-rose-500/5 text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
                      : "bg-muted text-muted-foreground hover:bg-muted-foreground/20",
                isToday && "ring-2 ring-primary ring-offset-1 ring-offset-background",
              )}
            >
              {complete ? <Check className="h-3.5 w-3.5" /> : d.dia}
            </button>
          );
        })}
      </div>

      {/* Contador do dia (quando diária > 1) */}
      <Dialog open={editing !== null} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>
              Dia {editing?.dia} · {row.client_nome}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col items-center gap-3 py-2">
            <div className="text-3xl font-bold tabular-nums">
              {editCount}
              <span className="text-lg font-medium text-muted-foreground"> / {diaria}</span>
            </div>
            <div className="flex items-center gap-4">
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={pending || editCount <= 0}
                onClick={() => editing && save(editing.dia, editing.data, editCount - 1)}
                aria-label="Menos um"
              >
                <Minus className="h-5 w-5" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={pending || editCount >= diaria}
                onClick={() => editing && save(editing.dia, editing.data, editCount + 1)}
                aria-label="Mais um"
              >
                <Plus className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => editing && save(editing.dia, editing.data, 0)}
              >
                Zerar
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => editing && save(editing.dia, editing.data, diaria)}
              >
                Completar ({diaria})
              </Button>
            </div>
            {editCount >= diaria && (
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">✓ Dia completo</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" onClick={() => setEditing(null)}>
              Pronto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
