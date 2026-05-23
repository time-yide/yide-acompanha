"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Video, AlertCircle } from "lucide-react";
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
import { delegateVideomakerAction } from "@/lib/audiovisual/coord-actions";
import type {
  VideomakerOption,
  ScheduledRowForVideomaker,
} from "@/lib/audiovisual/coord-queries";

interface Props {
  eventId: string;
  eventTitulo: string;
  eventInicio: string;
  eventFim: string;
  videomakers: VideomakerOption[];
  /** Map de videomaker_id → eventos agendados nele (pra avisar quem tá sobrecarregado). */
  scheduledByVideomaker: Record<string, ScheduledRowForVideomaker[]>;
  /** Quando false, dialog não abre - botão fica indicando "read only". */
  canDelegate?: boolean;
  trigger?: React.ReactNode;
}

function rangesOverlap(
  a: { inicio: string; fim: string },
  b: { inicio: string; fim: string },
): boolean {
  return new Date(a.inicio) < new Date(b.fim) && new Date(a.fim) > new Date(b.inicio);
}

export function DelegarVideomakerDialog({
  eventId,
  eventTitulo,
  eventInicio,
  eventFim,
  videomakers,
  scheduledByVideomaker,
  canDelegate = true,
  trigger,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [videomakerId, setVideomakerId] = useState<string>("");
  const [pending, startTransition] = useTransition();

  // Quem não pode delegar (ex: viewer read-only) vê badge em vez do botão.
  if (!canDelegate) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
        <Video className="h-3.5 w-3.5" />
        Aguardando coord audiovisual
      </span>
    );
  }

  const selectedScheduled = videomakerId
    ? scheduledByVideomaker[videomakerId] ?? []
    : [];
  const hasConflict = selectedScheduled.some((s) =>
    rangesOverlap({ inicio: eventInicio, fim: eventFim }, s),
  );

  function handleSubmit() {
    if (!videomakerId) {
      toast.error("Selecione um videomaker");
      return;
    }
    const fd = new FormData();
    fd.set("event_id", eventId);
    fd.set("videomaker_id", videomakerId);
    startTransition(async () => {
      const r = await delegateVideomakerAction(fd);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Captação delegada");
      setOpen(false);
      setVideomakerId("");
      router.refresh();
    });
  }

  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : (
        <Button onClick={() => setOpen(true)} size="sm">
          <Video className="mr-1.5 h-3.5 w-3.5" />
          Delegar videomaker
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Delegar captação</DialogTitle>
            <DialogDescription>
              Escolha qual videomaker vai gravar &ldquo;{eventTitulo}&rdquo;.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor={`vm-select-${eventId}`}>Videomaker</Label>
              {/* Select HTML nativo - evita problemas de Portal/z-index do
                  SearchableSelect dentro do Dialog (Radix). Coord audiovisual
                  reportou que não conseguia abrir o dropdown. */}
              <select
                id={`vm-select-${eventId}`}
                value={videomakerId}
                onChange={(e) => setVideomakerId(e.target.value)}
                disabled={pending || videomakers.length === 0}
                className="block h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
              >
                <option value="">
                  {videomakers.length === 0
                    ? "Nenhum videomaker ativo cadastrado"
                    : "Selecione o videomaker"}
                </option>
                {videomakers.map((v) => {
                  const count = scheduledByVideomaker[v.id]?.length ?? 0;
                  return (
                    <option key={v.id} value={v.id}>
                      {count > 0
                        ? `${v.nome} · ${count} agendada${count > 1 ? "s" : ""}`
                        : v.nome}
                    </option>
                  );
                })}
              </select>
              <p className="text-[11px] text-muted-foreground">
                Sistema bloqueia se o videomaker já tiver captação no mesmo horário.
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

            {videomakerId && selectedScheduled.length > 0 && !hasConflict && (
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
              disabled={pending || !videomakerId || hasConflict}
            >
              {pending ? "Delegando..." : "Delegar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
