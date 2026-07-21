"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { encerrarPesquisaAction } from "@/lib/pesquisas/actions";
import type { Resultados } from "@/lib/pesquisas/queries";
import {
  ehQuizTemperamento,
  calcularTemperamento,
  LETRA_TEMPERAMENTO,
  type Letra,
} from "@/lib/pesquisas/temperamento";

function Barra({ label, valor, total }: { label: string; valor: number; total: number }) {
  const pct = total > 0 ? Math.round((valor / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="truncate">{label}</span>
        <span className="text-muted-foreground">{valor} ({pct}%)</span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function ResultadosView({ resultados, canManage }: { resultados: Resultados; canManage: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { pesquisa, perguntas, total_destinatarios, total_respondidos, porPessoa } = resultados;

  const isQuiz = ehQuizTemperamento(
    perguntas.map((p) => ({ tipo: p.pergunta.tipo, opcoes: p.pergunta.opcoes })),
  );
  const [aba, setAba] = useState<"temperamento" | "perguntas">(isQuiz ? "temperamento" : "perguntas");

  // Temperamento por pessoa + resumo do time (só quiz identificado).
  const pessoasTemperamento =
    isQuiz && porPessoa
      ? porPessoa.map((p) => ({ nome: p.nome, ...calcularTemperamento(p.escolhas) }))
      : [];
  const resumo: Record<Letra, number> = { A: 0, B: 0, C: 0, D: 0 };
  for (const p of pessoasTemperamento) if (p.predominante) resumo[p.predominante]++;

  function encerrar() {
    startTransition(async () => {
      const r = await encerrarPesquisaAction(pesquisa.id);
      if (r?.error) toast.error(r.error);
      else {
        toast.success("Pesquisa encerrada");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{pesquisa.titulo}</h1>
          <p className="text-sm text-muted-foreground">
            {pesquisa.anonima ? "Anônima · " : ""}
            {total_respondidos}/{total_destinatarios} responderam ·{" "}
            {pesquisa.status === "aberta" ? "Aberta" : "Encerrada"}
          </p>
        </div>
        {canManage && pesquisa.status === "aberta" && (
          <Button type="button" variant="outline" onClick={encerrar} disabled={pending}>
            {pending ? "Encerrando..." : "Encerrar"}
          </Button>
        )}
      </header>

      {pesquisa.anonima && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          Pesquisa anônima — só o resultado agregado, sem ligar respostas a pessoas.
        </p>
      )}

      {isQuiz && (
        <div className="flex gap-2 border-b">
          <button
            type="button"
            onClick={() => setAba("temperamento")}
            className={`px-3 py-2 text-sm font-medium ${aba === "temperamento" ? "border-b-2 border-primary text-foreground" : "text-muted-foreground"}`}
          >
            Temperamento
          </button>
          <button
            type="button"
            onClick={() => setAba("perguntas")}
            className={`px-3 py-2 text-sm font-medium ${aba === "perguntas" ? "border-b-2 border-primary text-foreground" : "text-muted-foreground"}`}
          >
            Por pergunta
          </button>
        </div>
      )}

      {isQuiz && aba === "temperamento" && (
        <div className="space-y-4">
          {porPessoa === null ? (
            <p className="text-sm text-muted-foreground">
              Esta pesquisa é anônima — não dá pra calcular o temperamento por pessoa.
            </p>
          ) : (
            <>
              <Card className="space-y-3 p-4">
                <p className="text-sm font-medium">Resumo do time</p>
                {(Object.keys(LETRA_TEMPERAMENTO) as Letra[]).map((l) => (
                  <Barra
                    key={l}
                    label={LETRA_TEMPERAMENTO[l]}
                    valor={resumo[l]}
                    total={pessoasTemperamento.length}
                  />
                ))}
              </Card>
              <Card className="space-y-2 p-4">
                <p className="text-sm font-medium">Por pessoa</p>
                {pessoasTemperamento.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Ninguém respondeu ainda.</p>
                ) : (
                  pessoasTemperamento.map((p, i) => (
                    <div key={i} className="flex items-center justify-between border-b py-1.5 last:border-0">
                      <span className="text-sm">{p.nome}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground">
                          A{p.contagem.A} · B{p.contagem.B} · C{p.contagem.C} · D{p.contagem.D}
                        </span>
                        {p.predominante && (
                          <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                            {LETRA_TEMPERAMENTO[p.predominante]}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </Card>
            </>
          )}
        </div>
      )}

      {(!isQuiz || aba === "perguntas") && perguntas.map(({ pergunta, agregacao }, i) => (
        <Card key={pergunta.id} className="space-y-3 p-4">
          <p className="text-sm font-medium">
            {i + 1}. {pergunta.enunciado}
            <span className="ml-2 text-xs text-muted-foreground">({agregacao.total} resposta{agregacao.total === 1 ? "" : "s"})</span>
          </p>

          {agregacao.tipo === "multipla_escolha" && (
            <div className="space-y-2">
              {Object.entries(agregacao.contagem).map(([opcao, n]) => (
                <Barra key={opcao} label={opcao} valor={n} total={agregacao.total} />
              ))}
            </div>
          )}

          {agregacao.tipo === "escala" && (
            <p className="text-2xl font-bold">
              {agregacao.media.toFixed(1)}
              <span className="ml-1 text-sm font-normal text-muted-foreground">média</span>
            </p>
          )}

          {agregacao.tipo === "sim_nao" && (
            <div className="space-y-2">
              <Barra label="Sim" valor={agregacao.sim} total={agregacao.total} />
              <Barra label="Não" valor={agregacao.nao} total={agregacao.total} />
            </div>
          )}

          {agregacao.tipo === "texto" && (
            <ul className="space-y-1.5">
              {agregacao.textos.length === 0 ? (
                <li className="text-xs text-muted-foreground">Sem respostas ainda.</li>
              ) : (
                agregacao.textos.map((t, ti) => (
                  <li key={ti} className="rounded-md border bg-muted/30 px-3 py-1.5 text-sm">{t}</li>
                ))
              )}
            </ul>
          )}
        </Card>
      ))}
    </div>
  );
}
