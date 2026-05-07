import Link from "next/link";
import { Lock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PendenteEvento } from "@/lib/audiovisual/queries";

interface Props {
  /** Lista de pendências expiradas (já passaram do prazo D+1 09h). */
  overdue: PendenteEvento[];
  /** Se true, esconde o gate (ex: já está em /audiovisual). */
  hidden?: boolean;
}

function formatDateBR(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function CapturaPendenteLockGate({ overdue, hidden = false }: Props) {
  if (overdue.length === 0 || hidden) return null;

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
              Você tem {overdue.length} captação(ões) atrasada(s). Entregue o link do Drive e o feedback pra liberar o sistema.
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
            Gravações sem entrega
          </p>
          <ul className="space-y-1.5 text-sm">
            {overdue.map((p) => (
              <li key={p.event_id} className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{formatDateBR(p.inicio)}</span>
                <span className="text-muted-foreground">·</span>
                <span>{p.titulo}</span>
                {p.client_nome && (
                  <>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">{p.client_nome}</span>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex justify-center">
          <Link href="/audiovisual">
            <Button>Ir para Audiovisual</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
