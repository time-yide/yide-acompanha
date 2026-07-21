"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, UserPlus } from "lucide-react";
import {
  encerrarPesquisaAction,
  excluirRespostaAction,
  adicionarDestinatariosAction,
} from "@/lib/pesquisas/actions";
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

export function ResultadosView({
  resultados,
  canManage,
  candidatos = [],
}: {
  resultados: Resultados;
  canManage: boolean;
  candidatos?: Array<{ id: string; nome: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { pesquisa, perguntas, total_destinatarios, total_respondidos, porPessoa, faltamResponder } = resultados;

  const [addOpen, setAddOpen] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState("");

  const isQuiz = ehQuizTemperamento(
    perguntas.map((p) => ({ tipo: p.pergunta.tipo, opcoes: p.pergunta.opcoes })),
  );
  const [aba, setAba] = useState<"temperamento" | "perguntas">(isQuiz ? "temperamento" : "perguntas");

  // Temperamento por pessoa + resumo do time (só quiz identificado).
  const pessoasTemperamento =
    isQuiz && porPessoa
      ? porPessoa.map((p) => ({ userId: p.userId, nome: p.nome, ...calcularTemperamento(p.escolhas) }))
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

  function excluirResposta(userId: string, nome: string) {
    if (!window.confirm(`Excluir a resposta de ${nome}? A pessoa volta a ficar pendente e pode responder de novo.`)) return;
    startTransition(async () => {
      const r = await excluirRespostaAction(pesquisa.id, userId);
      if (r?.error) toast.error(r.error);
      else {
        toast.success(`Resposta de ${nome} excluída — já pode responder de novo`);
        router.refresh();
      }
    });
  }

  function toggleSel(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function adicionarPessoas() {
    const ids = [...selecionados];
    if (ids.length === 0) return;
    startTransition(async () => {
      const r = await adicionarDestinatariosAction(pesquisa.id, ids);
      if (r?.error) toast.error(r.error);
      else {
        toast.success(`${ids.length} pessoa(s) adicionada(s) — já podem responder`);
        setSelecionados(new Set());
        setBusca("");
        setAddOpen(false);
        router.refresh();
      }
    });
  }

  const podeRefazer = canManage && pesquisa.status === "aberta";
  const podeAdicionar = canManage && pesquisa.status === "aberta";
  const candidatosFiltrados = candidatos.filter((c) =>
    c.nome.toLowerCase().includes(busca.trim().toLowerCase()),
  );

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

      {canManage && (
        faltamResponder.length === 0 ? (
          total_destinatarios > 0 && (
            <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
              🎉 Todo mundo já respondeu.
            </p>
          )
        ) : (
          <Card className="space-y-2 p-4">
            <p className="text-sm font-medium">Faltam responder ({faltamResponder.length})</p>
            <div className="flex flex-wrap gap-1.5">
              {faltamResponder.map((nome, i) => (
                <Badge key={i} variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                  {nome}
                </Badge>
              ))}
            </div>
          </Card>
        )
      )}

      {podeAdicionar && (
        <Card className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">Adicionar pessoas</p>
              <p className="text-xs text-muted-foreground">
                Inclui quem entrou no time depois do disparo e não recebeu a pesquisa.
              </p>
            </div>
            {!addOpen && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAddOpen(true)}
                disabled={candidatos.length === 0}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                {candidatos.length === 0 ? "Todos já incluídos" : "Adicionar"}
              </Button>
            )}
          </div>

          {addOpen && (
            <div className="space-y-3">
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar pessoa…"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-1">
                {candidatosFiltrados.length === 0 ? (
                  <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                    Ninguém encontrado.
                  </p>
                ) : (
                  candidatosFiltrados.map((c) => (
                    <label
                      key={c.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
                    >
                      <input
                        type="checkbox"
                        checked={selecionados.has(c.id)}
                        onChange={() => toggleSel(c.id)}
                        className="h-4 w-4"
                      />
                      {c.nome}
                    </label>
                  ))
                )}
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAddOpen(false);
                    setSelecionados(new Set());
                    setBusca("");
                  }}
                  disabled={pending}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={adicionarPessoas}
                  disabled={pending || selecionados.size === 0}
                >
                  {pending ? "Adicionando…" : `Adicionar (${selecionados.size})`}
                </Button>
              </div>
            </div>
          )}
        </Card>
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
                        {podeRefazer && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            title="Excluir resposta pra refazer"
                            disabled={pending}
                            onClick={() => excluirResposta(p.userId, p.nome)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
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
