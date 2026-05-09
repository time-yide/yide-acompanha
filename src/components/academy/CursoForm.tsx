"use client";

import { useActionState, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { QUESTOES_POR_CURSO } from "@/lib/academy/schema";

interface ProfileOption {
  id: string;
  nome: string;
}

type ActionResult = { error?: string } | undefined;

interface QuestaoLocal {
  enunciado: string;
  alternativas: [string, string, string, string];
  correta: number; // 0..3
}

function emptyQuestao(): QuestaoLocal {
  return { enunciado: "", alternativas: ["", "", "", ""], correta: 0 };
}

export function CursoForm({
  action,
  profiles,
}: {
  action: (state: ActionResult, formData: FormData) => Promise<ActionResult>;
  profiles: ProfileOption[];
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [responsaveis, setResponsaveis] = useState<string[]>([]);
  const [questoes, setQuestoes] = useState<QuestaoLocal[]>(() =>
    Array.from({ length: QUESTOES_POR_CURSO }, emptyQuestao),
  );
  const [search, setSearch] = useState("");

  function toggleResponsavel(id: string) {
    setResponsaveis((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }

  function updateQuestao(idx: number, patch: Partial<QuestaoLocal>) {
    setQuestoes((prev) => prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  }

  function updateAlternativa(qIdx: number, altIdx: number, value: string) {
    setQuestoes((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const alts = [...q.alternativas] as [string, string, string, string];
        alts[altIdx] = value;
        return { ...q, alternativas: alts };
      }),
    );
  }

  const filteredProfiles = profiles.filter((p) =>
    p.nome.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <form action={formAction} className="space-y-6">
      {state?.error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <input type="hidden" name="responsaveis_ids" value={JSON.stringify(responsaveis)} />
      <input type="hidden" name="questoes" value={JSON.stringify(questoes)} />

      <div className="space-y-2">
        <Label htmlFor="titulo">Título do treinamento</Label>
        <Input id="titulo" name="titulo" required minLength={2} maxLength={200} placeholder="Ex: Onboarding comercial 2026" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="descricao">Descrição / material</Label>
        <Textarea
          id="descricao"
          name="descricao"
          rows={5}
          required
          placeholder={`Texto livre. Pode incluir:\n- Link do curso (Hotmart, YouTube, Notion...)\n- Data/local de treinamento presencial\n- Resumo do conteúdo\n- Instruções pra fazer a prova`}
        />
      </div>

      <div className="space-y-2 rounded-lg border bg-muted/20 p-4">
        <div className="flex items-center justify-between">
          <Label>Responsáveis ({responsaveis.length} selecionados)</Label>
        </div>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar colaborador..."
        />
        <div className="max-h-56 overflow-y-auto rounded-md border bg-card">
          {filteredProfiles.length === 0 && (
            <p className="p-3 text-xs text-muted-foreground">Ninguém encontrado.</p>
          )}
          {filteredProfiles.map((p) => {
            const selected = responsaveis.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggleResponsavel(p.id)}
                className={`flex w-full items-center justify-between border-b px-3 py-2 text-sm last:border-b-0 hover:bg-muted/40 ${
                  selected ? "bg-primary/5" : ""
                }`}
              >
                <span>{p.nome}</span>
                {selected && <CheckCircle2 className="h-4 w-4 text-primary" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Questionário (10 perguntas obrigatórias)</h2>
        <p className="text-xs text-muted-foreground">
          Marque a alternativa correta clicando no círculo verde. O participante precisa
          acertar pelo menos 7 de 10 pra concluir.
        </p>

        {questoes.map((q, idx) => (
          <div key={idx} className="space-y-3 rounded-lg border bg-card p-4">
            <div className="flex items-start gap-2">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {idx + 1}
              </span>
              <Textarea
                value={q.enunciado}
                onChange={(e) => updateQuestao(idx, { enunciado: e.target.value })}
                rows={2}
                placeholder="Enunciado da pergunta"
                required
              />
            </div>
            <div className="space-y-2 pl-8">
              {q.alternativas.map((alt, altIdx) => {
                const selected = q.correta === altIdx;
                return (
                  <div key={altIdx} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateQuestao(idx, { correta: altIdx })}
                      aria-label={`Marcar alternativa ${String.fromCharCode(65 + altIdx)} como correta`}
                      className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                        selected
                          ? "border-emerald-500 bg-emerald-500/15 text-emerald-600"
                          : "border-muted-foreground/30 hover:border-emerald-500/40"
                      }`}
                    >
                      {selected ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="text-[10px] font-medium text-muted-foreground">{String.fromCharCode(65 + altIdx)}</span>}
                    </button>
                    <Input
                      value={alt}
                      onChange={(e) => updateAlternativa(idx, altIdx, e.target.value)}
                      placeholder={`Alternativa ${String.fromCharCode(65 + altIdx)}`}
                      required
                      maxLength={300}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end gap-2 border-t pt-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Criando..." : "Criar treinamento"}
        </Button>
      </div>
    </form>
  );
}
