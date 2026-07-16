"use client";

import Link from "next/link";
import { Check, Clock } from "lucide-react";

interface Props {
  /** Id da tarefa de design auto-criada no upload do cronograma (ou null). */
  designTaskId: string | null;
  /** Status da tarefa de design; "entregue" = status ∈ {postada, concluida}. */
  designTaskStatus: string | null;
}

/**
 * Célula Design: reflete o status da tarefa auto-criada no upload do cronograma.
 *  - Sem tarefa (sem crono ainda): "—".
 *  - Tarefa pendente: âmbar "Pendente".
 *  - Tarefa entregue (postada/concluida): verde "Entregue".
 * Se há tarefa, clicar leva pra /tarefas/<id>.
 */
export function DesignCell({ designTaskId, designTaskStatus }: Props) {
  if (!designTaskId) {
    return <span className="text-[11px] text-muted-foreground/60">—</span>;
  }

  const entregue = designTaskStatus === "postada" || designTaskStatus === "concluida";

  const classes = entregue
    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
    : "border-amber-500/40 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300";

  return (
    <Link
      href={`/tarefas/${designTaskId}`}
      className={`inline-flex h-7 items-center gap-1 rounded-full border px-2 text-[11px] font-medium transition-colors ${classes}`}
      title={entregue ? "Design entregue" : "Design pendente"}
    >
      {entregue ? <Check className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
      <span>{entregue ? "Entregue" : "Pendente"}</span>
    </Link>
  );
}
