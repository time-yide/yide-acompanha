"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CapturaForm } from "./CapturaForm";
import type { EventoSemCapturaRow } from "@/lib/audiovisual/queries";

interface Props {
  rows: EventoSemCapturaRow[];
  /** Quando true, mostra coluna do videomaker. Pro próprio videomaker, oculta (é redundante). */
  showVideomaker: boolean;
  /** Quando true, clique abre dialog com CapturaForm pra entregar inline. */
  canDeliver: boolean;
  clientes: Array<{ id: string; nome: string }>;
}

function formatDateBR(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function formatTimeBR(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function PendenteEntregaAba({ rows, showVideomaker, canDeliver, clientes }: Props) {
  const [openEvent, setOpenEvent] = useState<EventoSemCapturaRow | null>(null);

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Nenhuma gravação pendente de entrega. ✨
      </p>
    );
  }

  const overdueCount = rows.filter((r) => r.isOverdue).length;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground/80">
          Pendente de entrega
          <span className="ml-1 text-xs font-normal text-muted-foreground">({rows.length})</span>
        </h2>
        {overdueCount > 0 && (
          <p className="flex items-center gap-1 text-xs text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" />
            {overdueCount} atrasada{overdueCount === 1 ? "" : "s"} (passou de D+1 09h)
          </p>
        )}
      </div>

      <ul className="space-y-2">
        {rows.map((r, idx) => {
          const key = `${r.event_id}-${r.videomaker_id}-${idx}`;
          const content = (
            <div className="flex items-start justify-between gap-2 rounded-lg border bg-card p-3 hover:bg-muted/40">
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                    {formatDateBR(r.inicio)} · {formatTimeBR(r.inicio)}
                  </span>
                  {r.isOverdue && (
                    <span className="rounded-md border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium uppercase text-destructive">
                      Atrasada
                    </span>
                  )}
                </div>
                <p className="truncate text-sm font-medium">{r.titulo}</p>
                <p className="text-xs text-muted-foreground">
                  {r.client_nome ?? "Cliente —"}
                  {showVideomaker && r.videomaker_nome && <> · {r.videomaker_nome}</>}
                </p>
              </div>
              {canDeliver && <Upload className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />}
            </div>
          );

          return (
            <li key={key}>
              {canDeliver ? (
                <button type="button" onClick={() => setOpenEvent(r)} className="block w-full text-left">
                  {content}
                </button>
              ) : (
                <Link href="/calendario" className="block">
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      {openEvent && (
        <Dialog open={openEvent !== null} onOpenChange={(o) => { if (!o) setOpenEvent(null); }}>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Entregar captação</DialogTitle>
              <DialogDescription>
                {openEvent.titulo} · {formatDateBR(openEvent.inicio)}
                {openEvent.client_nome && ` · ${openEvent.client_nome}`}
              </DialogDescription>
            </DialogHeader>
            <CapturaForm
              clientes={clientes}
              pendentes={[{
                event_id: openEvent.event_id,
                titulo: openEvent.titulo,
                inicio: openEvent.inicio,
                client_id: openEvent.client_id,
                client_nome: openEvent.client_nome,
                videomaker_id: openEvent.videomaker_id,
                isOverdue: openEvent.isOverdue,
              }]}
              hidePendenteSelect
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
