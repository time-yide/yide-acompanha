"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";

type ActionResult = { error?: string } | undefined;

interface QuestaoView {
  ordem: number;
  enunciado: string;
  alternativas: string[];
}

interface Props {
  cursoId: string;
  questoes: QuestaoView[];
  action: (state: ActionResult, formData: FormData) => Promise<ActionResult>;
}

export function ProvaForm({ cursoId, questoes, action }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  // respostas[i] = índice (0..3) escolhido pra questão i; -1 = sem resposta
  const [respostas, setRespostas] = useState<number[]>(() => questoes.map(() => -1));

  function pickAlternativa(qIdx: number, altIdx: number) {
    setRespostas((prev) => prev.map((r, i) => (i === qIdx ? altIdx : r)));
  }

  const todasRespondidas = respostas.every((r) => r >= 0);

  return (
    <form action={formAction} className="space-y-5">
      {state?.error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <input type="hidden" name="curso_id" value={cursoId} />
      <input type="hidden" name="respostas" value={JSON.stringify(respostas)} />

      <ol className="space-y-5">
        {questoes.map((q, qIdx) => {
          const answered = respostas[qIdx] >= 0;
          return (
            <li key={q.ordem} className="space-y-3 rounded-lg border bg-card p-4">
              <div className="flex items-start gap-3">
                <span
                  className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    answered ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {q.ordem}
                </span>
                <p className="text-sm font-medium leading-relaxed">{q.enunciado}</p>
              </div>
              <div className="space-y-2 pl-10">
                {q.alternativas.map((alt, altIdx) => {
                  const selected = respostas[qIdx] === altIdx;
                  return (
                    <button
                      type="button"
                      key={altIdx}
                      onClick={() => pickAlternativa(qIdx, altIdx)}
                      className={`flex w-full items-start gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                        selected
                          ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                          : "hover:bg-muted/40"
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                          selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {String.fromCharCode(65 + altIdx)}
                      </span>
                      <span className="leading-snug">{alt}</span>
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <p className="text-xs text-muted-foreground">
          {respostas.filter((r) => r >= 0).length}/{questoes.length} respondidas
        </p>
        <Button type="submit" size="lg" disabled={!todasRespondidas || pending}>
          {pending ? "Enviando..." : "Enviar respostas"}
        </Button>
      </div>
    </form>
  );
}
