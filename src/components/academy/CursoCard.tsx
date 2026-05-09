import Link from "next/link";
import { CheckCircle2, Clock, Users } from "lucide-react";
import type { CursoComStatus } from "@/lib/academy/queries";

interface Props {
  curso: CursoComStatus;
}

const STATUS_TONE: Record<CursoComStatus["meu_status"], string> = {
  pendente: "border-l-amber-500",
  aprovado: "border-l-emerald-500",
  nao_atribuido: "border-l-slate-300 dark:border-l-slate-700",
};

export function CursoCard({ curso }: Props) {
  const isAprovado = curso.meu_status === "aprovado";
  const isPendente = curso.meu_status === "pendente";
  return (
    <Link
      href={`/academy/${curso.id}`}
      className={`group block rounded-lg border border-l-4 bg-card p-4 transition-colors hover:bg-card/80 ${STATUS_TONE[curso.meu_status]}`}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-snug line-clamp-2">{curso.titulo}</h3>
          {isAprovado && (
            <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500" />
          )}
          {isPendente && (
            <Clock className="h-4 w-4 flex-shrink-0 text-amber-500" />
          )}
        </div>
        {curso.criador && (
          <p className="text-xs text-muted-foreground">por {curso.criador.nome}</p>
        )}
        <div className="flex items-center gap-3 pt-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3" />
            {curso.total_aprovados}/{curso.total_responsaveis} aprovados
          </span>
          {isAprovado && curso.meu_acertos !== null && (
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              Sua nota: {curso.meu_acertos}/10
            </span>
          )}
          {isPendente && curso.meu_acertos !== null && (
            <span className="font-medium text-amber-700 dark:text-amber-400">
              Última: {curso.meu_acertos}/10
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
