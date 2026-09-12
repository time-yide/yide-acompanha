"use client";

import { useState, useTransition } from "react";
import { Bot, Loader2 } from "lucide-react";
import { ligarComIAAction } from "@/lib/voz-ia/actions";

interface Props {
  leadId: string;
  temTelefone: boolean;
  aiStatus: string | null;
  aiTentativas: number;
  maxTentativas?: number;
}

export function LigarIAButton({ leadId, temTelefone, aiStatus, aiTentativas, maxTentativas = 7 }: Props) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  const disabled = !temTelefone || aiStatus === "em_ligacao" || aiTentativas >= maxTentativas || pending;

  function handleClick() {
    setResult(null);
    startTransition(async () => {
      const res = await ligarComIAAction(leadId);
      if ("error" in res) {
        setResult(res.error);
      } else {
        setResult("Ligando...");
      }
    });
  }

  let title = "Ligar com IA";
  if (!temTelefone) title = "Lead sem telefone";
  else if (aiStatus === "em_ligacao") title = "Chamada IA ativa";
  else if (aiTentativas >= maxTentativas) title = "Tentativas esgotadas";

  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        title={title}
        className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bot className="h-3 w-3" />}
        IA
      </button>
      {aiStatus === "em_ligacao" && (
        <span className="text-xs text-amber-600 animate-pulse">Ligando...</span>
      )}
      {result && result !== "Ligando..." && (
        <span className="text-xs text-red-600">{result}</span>
      )}
    </div>
  );
}
