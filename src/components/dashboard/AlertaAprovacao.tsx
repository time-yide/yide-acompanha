import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { monthLabel } from "@/lib/dashboard/date-utils";

interface Props {
  mes: string | null;
}

export function AlertaAprovacao({ mes }: Props) {
  if (!mes) return null;
  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
            Mês de {monthLabel(mes)} aguardando sua aprovação
          </p>
          <p className="text-xs text-amber-800/80 dark:text-amber-200/80">
            Comissões precisam ser revisadas e aprovadas para fechamento.
          </p>
        </div>
      </div>
      <Link
        href="/comissoes/fechamento"
        className="shrink-0 text-sm font-medium text-amber-900 dark:text-amber-100 hover:underline"
      >
        Revisar agora →
      </Link>
    </div>
  );
}
