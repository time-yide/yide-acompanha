"use client";

import Link from "next/link";
import { Calendar, ListTodo, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { GravacaoItem, TaskItem } from "@/lib/dashboard/audiovisual";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nome: string;
  /** Quando "videomaker", mostra gravações. Quando "edicao", mostra tarefas pendentes. */
  variant: "videomaker" | "edicao";
  gravacoes?: GravacaoItem[];
  tarefas?: TaskItem[];
}

const STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  alteracao: "Alteração",
  em_aprovacao: "Em aprovação",
  aprovada: "Aprovada",
  postada: "Postada",
};

const PRIO_BADGE: Record<string, string> = {
  alta: "border-rose-500/40 text-rose-600 dark:text-rose-400",
  media: "border-amber-500/40 text-amber-600 dark:text-amber-400",
  baixa: "border-muted-foreground/30 text-muted-foreground",
};

function formatDateTimeBR(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
}

function formatDateBR(iso: string | null): string {
  if (!iso) return "Sem prazo";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR");
}

export function MemberDetailDialog({ open, onOpenChange, nome, variant, gravacoes = [], tarefas = [] }: Props) {
  const isVideomaker = variant === "videomaker";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isVideomaker ? <Calendar className="h-4 w-4" /> : <ListTodo className="h-4 w-4" />}
            {nome}
          </DialogTitle>
          <DialogDescription>
            {isVideomaker
              ? "Próximas gravações nas próximas 2 semanas."
              : "Tarefas pendentes (atribuído ou participante)."}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-2 overflow-y-auto">
          {isVideomaker ? (
            gravacoes.length === 0 ? (
              <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                Sem gravações nas próximas 2 semanas.
              </p>
            ) : (
              gravacoes.map((g) => (
                <Link
                  key={g.id}
                  href={`/calendario`}
                  className="flex items-start justify-between gap-2 rounded-lg border bg-card px-3 py-2 hover:bg-muted/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{g.titulo}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTimeBR(g.inicio)}</p>
                  </div>
                  <ExternalLink className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                </Link>
              ))
            )
          ) : tarefas.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
              Sem tarefas pendentes.
            </p>
          ) : (
            tarefas.map((t) => (
              <Link
                key={t.id}
                href={`/tarefas/${t.id}`}
                className="flex items-start justify-between gap-2 rounded-lg border bg-card px-3 py-2 hover:bg-muted/40"
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="truncate text-sm font-medium">{t.titulo}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{STATUS_LABEL[t.status] ?? t.status}</span>
                    <span>· Prazo {formatDateBR(t.due_date)}</span>
                    {t.prioridade && (
                      <span className={`rounded border px-1.5 py-0 text-[10px] uppercase ${PRIO_BADGE[t.prioridade] ?? ""}`}>
                        {t.prioridade}
                      </span>
                    )}
                  </div>
                </div>
                <ExternalLink className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
              </Link>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
