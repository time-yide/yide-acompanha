"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Minus, Plus, Check, Pencil, Trash2, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  setStoryDayCountAction,
  updateClienteDiariaStoriesAction,
  removeClienteStoriesAction,
} from "@/lib/painel/stories-actions";
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

  const router = useRouter();
  const [managing, setManaging] = useState(false);
  const [diariaInput, setDiariaInput] = useState<string>(String(row.quantidade_diaria_stories));
  const [confirmRemove, setConfirmRemove] = useState(false);

  function saveDiaria() {
    const n = Number(diariaInput);
    if (!Number.isInteger(n) || n < 1 || n > 99) {
      toast.error("Quantidade diária deve ser de 1 a 99");
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set("client_id", row.client_id);
      fd.set("quantidade_diaria", String(n));
      const res = await updateClienteDiariaStoriesAction(fd);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Quantidade diária atualizada");
      setManaging(false);
      router.refresh();
    });
  }

  function removeFromGrid() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("client_id", row.client_id);
      const res = await removeClienteStoriesAction(fd);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Cliente removido da grade");
      setManaging(false);
      setConfirmRemove(false);
      router.refresh();
    });
  }

  const totalPostados = Object.values(counts).reduce((s, v) => s + v, 0);
  const pct = row.meta > 0 ? Math.min(100, (totalPostados / row.meta) * 100) : 0;

  function save(dia: number, data: string, qtd: number) {
    if (!canEdit) return;
    // Permite passar do mínimo (fez mais que a diária). Cap alto só de segurança.
    const clamped = Math.max(0, Math.min(qtd, 99));
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
          <Link
            href={`/clientes/${row.client_id}`}
            className="group inline-flex items-center gap-1 truncate text-sm font-semibold hover:underline"
          >
            <span className="truncate">{row.client_nome}</span>
            <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
          <p className="text-xs text-muted-foreground">
            {row.quantidade_diaria_stories}/dia
            {row.assessor_nome ? ` · ${row.assessor_nome}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold tabular-nums">
            {totalPostados}
            <span className="text-xs font-medium text-muted-foreground"> / {row.meta}</span>
            <span className="ml-1.5 text-xs font-medium text-primary">{Math.round(pct)}%</span>
          </p>
          {canEdit && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              onClick={() => {
                setDiariaInput(String(row.quantidade_diaria_stories));
                setConfirmRemove(false);
                setManaging(true);
              }}
              aria-label="Gerenciar cliente"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
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
              {complete ? (c > diaria ? c : <Check className="h-3.5 w-3.5" />) : d.dia}
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
                disabled={pending || editCount >= 99}
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
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                ✓ Dia completo{editCount > diaria ? ` · +${editCount - diaria} além da meta` : ""}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" onClick={() => setEditing(null)}>
              Pronto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Gerenciar cliente: editar diária / remover da grade */}
      <Dialog
        open={managing}
        onOpenChange={(o) => {
          if (!o) {
            setManaging(false);
            setConfirmRemove(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>{row.client_nome}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor={`diaria-${row.client_id}`}>Stories por dia</Label>
              <Input
                id={`diaria-${row.client_id}`}
                type="number"
                min={1}
                max={99}
                step={1}
                value={diariaInput}
                onChange={(e) => setDiariaInput(e.target.value)}
                disabled={pending}
              />
            </div>

            {confirmRemove ? (
              <div className="space-y-2 rounded-md border border-rose-500/30 bg-rose-500/5 p-3">
                <p className="text-xs text-muted-foreground">
                  Remove o cliente da grade de stories. O histórico de marcações é
                  mantido — se readicionar depois, os stories já marcados reaparecem.
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={pending}
                    onClick={removeFromGrid}
                  >
                    {pending ? "Removendo..." : "Confirmar remoção"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => setConfirmRemove(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-rose-600 hover:text-rose-700 dark:text-rose-400"
                disabled={pending}
                onClick={() => setConfirmRemove(true)}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Remover da grade
              </Button>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setManaging(false)}>
              Fechar
            </Button>
            <Button type="button" disabled={pending} onClick={saveDiaria}>
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
