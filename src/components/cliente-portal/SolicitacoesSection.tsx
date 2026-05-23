"use client";

import { useState } from "react";
import { Plus, Inbox, CheckCircle2, Clock, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CATEGORIA_LABEL,
  STATUS_LABEL,
  type RequestRow,
  type Status,
} from "@/lib/portal-requests/schema";
import { NovaSolicitacaoDialog } from "./NovaSolicitacaoDialog";
import { SolicitacaoDetailDialog } from "./SolicitacaoDetailDialog";

interface Props {
  requests: RequestRow[];
}

const STATUS_ICON: Record<Status, React.ReactNode> = {
  aberta: <Clock className="h-3 w-3" />,
  em_andamento: <AlertCircle className="h-3 w-3" />,
  concluida: <CheckCircle2 className="h-3 w-3" />,
  cancelada: <X className="h-3 w-3" />,
};

const STATUS_TONE: Record<Status, string> = {
  aberta: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  em_andamento: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  concluida: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  cancelada: "bg-muted text-muted-foreground",
};

function formatBRshort(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: "America/Cuiaba",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export function SolicitacoesSection({ requests }: Props) {
  const [novaOpen, setNovaOpen] = useState(false);
  const [detalhe, setDetalhe] = useState<RequestRow | null>(null);

  const abertas = requests.filter((r) => r.status === "aberta" || r.status === "em_andamento");
  const resolvidas = requests.filter((r) => r.status === "concluida" || r.status === "cancelada");

  return (
    <>
      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="bg-gradient-to-br from-primary/10 via-card to-card p-6 sm:p-8">
          <header className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Inbox className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider">Solicitações</h2>
                <p className="text-xs text-muted-foreground">
                  Peça alterações, tráfego, reuniões - fica tudo organizado aqui
                </p>
              </div>
            </div>
            <Button size="sm" onClick={() => setNovaOpen(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Nova
            </Button>
          </header>

          {requests.length === 0 ? (
            <div className="mt-5 flex flex-col items-center gap-2 rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              <Inbox className="h-8 w-8 text-muted-foreground/40" />
              <p>Nenhuma solicitação ainda.</p>
              <p className="text-xs">
                Tem algum pedido pra equipe? Clica em <strong>Nova</strong> e abre.
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {abertas.length > 0 && (
                <SolicitacaoList
                  titulo="Em aberto"
                  count={abertas.length}
                  items={abertas}
                  onSelect={setDetalhe}
                />
              )}
              {resolvidas.length > 0 && (
                <SolicitacaoList
                  titulo="Histórico"
                  count={resolvidas.length}
                  items={resolvidas}
                  onSelect={setDetalhe}
                  muted
                />
              )}
            </div>
          )}
        </div>
      </section>

      <NovaSolicitacaoDialog open={novaOpen} onOpenChange={setNovaOpen} />
      {detalhe && (
        <SolicitacaoDetailDialog
          request={detalhe}
          open={!!detalhe}
          onOpenChange={(o) => !o && setDetalhe(null)}
        />
      )}
    </>
  );
}

function SolicitacaoList({
  titulo,
  count,
  items,
  onSelect,
  muted,
}: {
  titulo: string;
  count: number;
  items: RequestRow[];
  onSelect: (r: RequestRow) => void;
  muted?: boolean;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {titulo} ({count})
      </p>
      <ul className="space-y-1.5">
        {items.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => onSelect(r)}
              className={`flex w-full items-start gap-3 rounded-lg border bg-background/40 p-3 text-left hover:bg-background/70 ${muted ? "opacity-70" : ""}`}
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${STATUS_TONE[r.status]}`}
                  >
                    {STATUS_ICON[r.status]}
                    {STATUS_LABEL[r.status]}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {CATEGORIA_LABEL[r.categoria]}
                  </span>
                  {r.prioridade === "urgente" && (
                    <span className="rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-medium text-rose-700 dark:text-rose-300">
                      Urgente
                    </span>
                  )}
                </div>
                <p className="truncate text-sm font-medium">{r.titulo}</p>
                <p className="text-[11px] text-muted-foreground">
                  {formatBRshort(r.created_at)}
                </p>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
