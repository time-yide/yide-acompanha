"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock, AlertTriangle, Upload, ArrowRight } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CapturaForm } from "./CapturaForm";
import type { PendenteEvento } from "@/lib/audiovisual/queries";
import { APP_TIMEZONE } from "@/lib/datetime/timezone";

interface Props {
  /** Lista de pendências expiradas (já passaram do prazo D+1 09h). */
  overdue: PendenteEvento[];
  /** Clientes ativos pra preencher o select dentro do form de entrega. */
  clientes: Array<{ id: string; nome: string }>;
}

function formatDateBR(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: APP_TIMEZONE, day: "2-digit", month: "short" });
}

export function CapturaPendenteLockGate({ overdue, clientes }: Props) {
  const pathname = usePathname();
  const isOnAudiovisual = pathname?.startsWith("/audiovisual") ?? false;
  const [openPendente, setOpenPendente] = useState<PendenteEvento | null>(null);

  if (overdue.length === 0 || isOnAudiovisual) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-background/95 p-4 backdrop-blur-md sm:p-8">
      <div className="my-auto w-full max-w-2xl space-y-5 rounded-2xl border border-destructive/40 bg-card p-6 shadow-2xl ring-1 ring-destructive/20 sm:p-8">
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/15 text-destructive">
            <Lock className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight">Captação pendente</h2>
            <p className="text-sm text-muted-foreground">
              Você tem {overdue.length} captação(ões) atrasada(s). Suba o link do Drive e o feedback pra liberar o sistema.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <strong>Prazo: até 09h do dia seguinte à gravação.</strong>{" "}
            Após esse horário, o sistema bloqueia novas demandas até a entrega.
          </div>
        </div>

        <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Gravações sem entrega · clique pra entregar agora
          </p>
          <ul className="space-y-1.5">
            {overdue.map((p) => (
              <li key={p.event_id}>
                <button
                  type="button"
                  onClick={() => setOpenPendente(p)}
                  className="flex w-full items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-left text-sm hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{formatDateBR(p.inicio)}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="truncate">{p.titulo}</span>
                    </div>
                    {p.client_nome && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{p.client_nome}</p>
                    )}
                  </div>
                  <Upload className="h-4 w-4 flex-shrink-0 text-primary" />
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button type="button" onClick={() => setOpenPendente(overdue[0])}>
            <Upload className="mr-1.5 h-4 w-4" />
            Entregar a primeira agora
          </Button>
          <Link href="/audiovisual" className={buttonVariants({ variant: "outline" })}>
            Ir para Audiovisual
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Link>
        </div>
      </div>

      {openPendente && (
        <Dialog open={openPendente !== null} onOpenChange={(o) => { if (!o) setOpenPendente(null); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Entregar captação</DialogTitle>
              <DialogDescription>
                {openPendente.titulo} · {formatDateBR(openPendente.inicio)}
                {openPendente.client_nome && ` · ${openPendente.client_nome}`}
              </DialogDescription>
            </DialogHeader>
            {/* Reutiliza o form da página /audiovisual passando só esse pendente
                — ele aparece pré-selecionado no select interno. */}
            <CapturaForm clientes={clientes} pendentes={[openPendente]} hidePendenteSelect />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
