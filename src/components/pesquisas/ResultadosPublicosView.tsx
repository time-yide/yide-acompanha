import { PerguntasAgregadas } from "./PerguntasAgregadas";
import type { ResultadoPergunta } from "@/lib/pesquisas/queries";

export function ResultadosPublicosView({
  titulo,
  descricao,
  perguntas,
  totalRespondidos,
  totalDestinatarios,
  encerrada,
}: {
  titulo: string;
  descricao: string | null;
  perguntas: ResultadoPergunta[];
  totalRespondidos: number;
  totalDestinatarios: number;
  encerrada: boolean;
}) {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{titulo}</h1>
        {descricao && <p className="text-sm text-muted-foreground">{descricao}</p>}
        <p className="text-sm text-muted-foreground">
          {totalRespondidos}/{totalDestinatarios} responderam · {encerrada ? "Encerrada" : "Aberta"}
        </p>
      </header>
      <p className="rounded-md border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs text-sky-700 dark:text-sky-400">
        Visão do time: resultados agregados, sem identificar quem respondeu.
      </p>
      <PerguntasAgregadas perguntas={perguntas} />
    </div>
  );
}
