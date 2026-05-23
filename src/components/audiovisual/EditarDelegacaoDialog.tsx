"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { updateDelegacaoAction } from "@/lib/audiovisual/coord-actions";
import type {
  VideomakerOption,
  ScheduledRowForVideomaker,
  CoordOption,
} from "@/lib/audiovisual/coord-queries";

interface Props {
  eventId: string;
  eventTitulo: string;
  eventInicio: string;
  eventFim: string;
  currentVideomakerId: string;
  currentCoordId: string | null;
  videomakers: VideomakerOption[];
  coords: CoordOption[];
  /** Map de videomaker_id → eventos agendados nele (pra avisar overlap). */
  scheduledByVideomaker: Record<string, ScheduledRowForVideomaker[]>;
}

function rangesOverlap(
  a: { inicio: string; fim: string },
  b: { inicio: string; fim: string },
): boolean {
  return new Date(a.inicio) < new Date(b.fim) && new Date(a.fim) > new Date(b.inicio);
}

export function EditarDelegacaoDialog({
  eventId,
  eventTitulo,
  eventInicio,
  eventFim,
  currentVideomakerId,
  currentCoordId,
  videomakers,
  coords,
  scheduledByVideomaker,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [videomakerId, setVideomakerId] = useState(currentVideomakerId);
  const [coordId, setCoordId] = useState(currentCoordId ?? "");
  const [pending, startTransition] = useTransition();

  // Reset estado quando reabrir, pra refletir valores atuais
  function onOpenChange(next: boolean) {
    if (next) {
      setVideomakerId(currentVideomakerId);
      setCoordId(currentCoordId ?? "");
    }
    setOpen(next);
  }

  // Conflito só importa se o videomaker mudou. O evento atual é ignorado
  // (não conflita consigo mesmo).
  const changedVideomaker = videomakerId && videomakerId !== currentVideomakerId;
  const selectedScheduled = changedVideomaker
    ? (scheduledByVideomaker[videomakerId] ?? []).filter((s) => s.id !== eventId)
    : [];
  const hasConflict = changedVideomaker
    ? selectedScheduled.some((s) =>
        rangesOverlap({ inicio: eventInicio, fim: eventFim }, s),
      )
    : false;

  const changedCoord = coordId && coordId !== (currentCoordId ?? "");
  const hasChanges = Boolean(changedVideomaker || changedCoord);

  function handleSubmit() {
    if (!hasChanges) {
      toast.info("Nada pra atualizar");
      return;
    }
    const fd = new FormData();
    fd.set("event_id", eventId);
    if (changedVideomaker) fd.set("videomaker_id", videomakerId);
    if (changedCoord) fd.set("coord_id", coordId);
    startTransition(async () => {
      const r = await updateDelegacaoAction(fd);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Delegação atualizada");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-7 gap-1 px-2 text-xs"
      >
        <Pencil className="h-3 w-3" />
        Editar
      </Button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar delegação</DialogTitle>
            <DialogDescription>
              Trocar videomaker ou coord audiovisual de &ldquo;{eventTitulo}&rdquo;.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor={`vm-edit-${eventId}`}>Videomaker</Label>
              <select
                id={`vm-edit-${eventId}`}
                value={videomakerId}
                onChange={(e) => setVideomakerId(e.target.value)}
                disabled={pending || videomakers.length === 0}
                className="block h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
              >
                {videomakers.map((v) => {
                  const count = (scheduledByVideomaker[v.id] ?? []).filter(
                    (s) => s.id !== eventId,
                  ).length;
                  return (
                    <option key={v.id} value={v.id}>
                      {count > 0
                        ? `${v.nome} · ${count} agendada${count > 1 ? "s" : ""}`
                        : v.nome}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`coord-edit-${eventId}`}>Coord audiovisual</Label>
              <select
                id={`coord-edit-${eventId}`}
                value={coordId}
                onChange={(e) => setCoordId(e.target.value)}
                disabled={pending || coords.length === 0}
                className="block h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
              >
                <option value="">Selecione o coord</option>
                {coords.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">
                Quem fica como responsável pela delegação dessa captação.
              </p>
            </div>

            {hasConflict && (
              <div className="flex items-start gap-2 rounded-md border border-rose-500/40 bg-rose-500/10 p-2.5 text-xs">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-rose-600" />
                <div className="text-rose-700 dark:text-rose-300">
                  <p className="font-medium">Conflito de horário</p>
                  <p>
                    Esse videomaker já tem captação sobreposta. Escolha outro
                    ou ajuste o horário do evento.
                  </p>
                </div>
              </div>
            )}

            {changedVideomaker && selectedScheduled.length > 0 && !hasConflict && (
              <details className="rounded-md border bg-muted/30 p-2.5 text-xs">
                <summary className="cursor-pointer font-medium">
                  Agenda dele nos próximos 14 dias ({selectedScheduled.length} {selectedScheduled.length === 1 ? "evento" : "eventos"})
                </summary>
                <ul className="mt-2 space-y-1 text-muted-foreground">
                  {selectedScheduled.map((s) => (
                    <li key={s.id} className="flex justify-between gap-2">
                      <span className="truncate">{s.titulo}</span>
                      <span className="flex-shrink-0 tabular-nums">
                        {new Date(s.inicio).toLocaleString("pt-BR", {
                          timeZone: "America/Cuiaba",
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={pending || !hasChanges || hasConflict}
            >
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
