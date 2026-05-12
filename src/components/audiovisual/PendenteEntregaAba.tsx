"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Upload, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CapturaForm } from "./CapturaForm";
import { MarcarEntregueRapidoDialog } from "./MarcarEntregueRapidoDialog";
import type { EventoSemCapturaRow } from "@/lib/audiovisual/queries";
import { APP_TIMEZONE } from "@/lib/datetime/timezone";

interface Props {
  rows: EventoSemCapturaRow[];
  /** Quando true, mostra coluna do videomaker. Pro próprio videomaker, oculta (é redundante). */
  showVideomaker: boolean;
  /**
   * Form completo com 7 ratings + URL obrigatórios. Normalmente só pro
   * videomaker que fez a gravação (vai dar feedback do cliente).
   */
  canDeliver: boolean;
  /**
   * Marcação rápida (sem ratings) — pra casos onde a entrega já aconteceu
   * fora do sistema, deu erro, ou gestor precisa destravar manualmente.
   * Tipicamente videomaker + coord/audiovisual_chefe/adm/socio.
   */
  canQuickMark?: boolean;
  clientes: Array<{ id: string; nome: string }>;
}

function formatDateBR(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: APP_TIMEZONE, day: "2-digit", month: "2-digit", year: "2-digit" });
}

function formatTimeBR(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { timeZone: APP_TIMEZONE, hour: "2-digit", minute: "2-digit" });
}

export function PendenteEntregaAba({ rows, showVideomaker, canDeliver, canQuickMark = false, clientes }: Props) {
  const [openEvent, setOpenEvent] = useState<EventoSemCapturaRow | null>(null);
  const [openRapidoEvent, setOpenRapidoEvent] = useState<EventoSemCapturaRow | null>(null);

  // Tem alguma ação disponível? (form completo OU rápido)
  const hasAnyAction = canDeliver || canQuickMark;

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

          const cardBody = (
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
          );

          // Sem nenhuma ação disponível — só link pro calendário (visualizar)
          if (!hasAnyAction) {
            return (
              <li key={key}>
                <Link
                  href="/calendario"
                  className="flex items-start justify-between gap-2 rounded-lg border bg-card p-3 hover:bg-muted/40"
                >
                  {cardBody}
                </Link>
              </li>
            );
          }

          // Função do clique no corpo do card — prefere form completo se disponível
          const handleBodyClick = () => {
            if (canDeliver) setOpenEvent(r);
            else if (canQuickMark) setOpenRapidoEvent(r);
          };

          return (
            <li key={key}>
              <div className="flex items-start gap-2 rounded-lg border bg-card p-3 hover:bg-muted/40">
                <button
                  type="button"
                  onClick={handleBodyClick}
                  className="flex min-w-0 flex-1 text-left"
                  title={canDeliver
                    ? "Entregar com feedback completo (ratings + observações)"
                    : "Marcar como entregue (sem feedback completo)"}
                >
                  {cardBody}
                </button>

                {/* Botões de ação à direita */}
                <div className="flex shrink-0 items-start gap-1">
                  {/* Marcar entregue (rápido) — sem ratings */}
                  {canQuickMark && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenRapidoEvent(r);
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/5 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300"
                      title="Marcar como entregue sem preencher feedback completo (útil quando a entrega aconteceu fora do sistema)"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Entregue
                    </button>
                  )}

                  {/* Form completo — ícone Upload */}
                  {canDeliver && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenEvent(r);
                      }}
                      className="rounded-md p-1.5 text-primary hover:bg-primary/10"
                      title="Entregar com feedback completo (ratings + observações)"
                    >
                      <Upload className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
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
              }]}
              hidePendenteSelect
            />
          </DialogContent>
        </Dialog>
      )}

      {openRapidoEvent && (
        <MarcarEntregueRapidoDialog
          open={openRapidoEvent !== null}
          onOpenChange={(o) => { if (!o) setOpenRapidoEvent(null); }}
          eventId={openRapidoEvent.event_id}
          titulo={`${openRapidoEvent.titulo}${openRapidoEvent.client_nome ? ` · ${openRapidoEvent.client_nome}` : ""}`}
          onPedirFormCompleto={() => {
            const ev = openRapidoEvent;
            setOpenRapidoEvent(null);
            setOpenEvent(ev);
          }}
        />
      )}
    </div>
  );
}
