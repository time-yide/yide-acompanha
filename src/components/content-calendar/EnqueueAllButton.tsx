"use client";

import { useState, useTransition } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { enqueueAllCalendarsAction } from "@/lib/content-calendar/actions";

interface Props {
  mes: string;
  monthLabel: string;
}

export function EnqueueAllButton({ mes, monthLabel }: Props) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  function handleClick() {
    startTransition(async () => {
      setResult(null);
      const res = await enqueueAllCalendarsAction(mes);
      if ("error" in res) {
        setResult(`Erro: ${res.error}`);
      } else if (res.created === 0) {
        setResult(
          res.skipped > 0
            ? `Todos os ${res.total} clientes já tinham cronograma para ${monthLabel}.`
            : "Nenhum cliente elegível encontrado (verifique se os clientes têm nicho configurado).",
        );
      } else {
        setResult(
          `${res.created} cronograma${res.created > 1 ? "s" : ""} enfileirado${res.created > 1 ? "s" : ""} para geração.${res.skipped > 0 ? ` (${res.skipped} já existiam)` : ""}`,
        );
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="sm" onClick={handleClick} disabled={pending}>
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {pending ? "Gerando..." : `Gerar cronogramas de ${monthLabel}`}
      </Button>
      {result && (
        <p className="text-xs text-muted-foreground">{result}</p>
      )}
    </div>
  );
}
