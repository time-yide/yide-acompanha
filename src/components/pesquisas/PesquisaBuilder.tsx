"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Plus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { savePerguntasAction } from "@/lib/pesquisas/actions";
import { PERGUNTA_TIPOS, PERGUNTA_TIPO_LABEL, type PerguntaTipo, type PerguntaRow } from "@/lib/pesquisas/schema";
import { DispararModal, type PublicoOptions } from "./DispararModal";

interface PerguntaDraft {
  tipo: PerguntaTipo;
  enunciado: string;
  opcoes: string[];
  escala_min: number;
  escala_max: number;
  obrigatoria: boolean;
}

function fromRow(r: PerguntaRow): PerguntaDraft {
  return {
    tipo: r.tipo,
    enunciado: r.enunciado,
    opcoes: r.opcoes ?? ["", ""],
    escala_min: r.escala_min ?? 1,
    escala_max: r.escala_max ?? 5,
    obrigatoria: r.obrigatoria,
  };
}

function nova(): PerguntaDraft {
  return { tipo: "multipla_escolha", enunciado: "", opcoes: ["", ""], escala_min: 1, escala_max: 5, obrigatoria: true };
}

export function PesquisaBuilder({
  pesquisaId,
  perguntasIniciais,
  opcoesPublico,
}: {
  pesquisaId: string;
  perguntasIniciais: PerguntaRow[];
  opcoesPublico: PublicoOptions;
}) {
  const router = useRouter();
  const [perguntas, setPerguntas] = useState<PerguntaDraft[]>(
    perguntasIniciais.length ? perguntasIniciais.map(fromRow) : [nova()],
  );
  const [dispararOpen, setDispararOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function update(i: number, patch: Partial<PerguntaDraft>) {
    setPerguntas((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }
  function remove(i: number) {
    setPerguntas((prev) => prev.filter((_, idx) => idx !== i));
  }

  function salvar(): void {
    startTransition(async () => {
      const payload = perguntas.map((p) => ({
        tipo: p.tipo,
        enunciado: p.enunciado,
        opcoes: p.tipo === "multipla_escolha" ? p.opcoes.map((o) => o.trim()).filter(Boolean) : undefined,
        escala_min: p.escala_min,
        escala_max: p.escala_max,
        obrigatoria: p.obrigatoria,
      }));
      const r = await savePerguntasAction(pesquisaId, payload);
      if (r?.error) toast.error(r.error);
      else toast.success("Perguntas salvas");
    });
  }

  async function salvarEDisparar() {
    const payload = perguntas.map((p) => ({
      tipo: p.tipo,
      enunciado: p.enunciado,
      opcoes: p.tipo === "multipla_escolha" ? p.opcoes.map((o) => o.trim()).filter(Boolean) : undefined,
      escala_min: p.escala_min,
      escala_max: p.escala_max,
      obrigatoria: p.obrigatoria,
    }));
    const r = await savePerguntasAction(pesquisaId, payload);
    if (r?.error) {
      toast.error(r.error);
      return;
    }
    setDispararOpen(true);
  }

  return (
    <div className="space-y-4">
      {perguntas.map((p, i) => (
        <Card key={i} className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <span className="text-xs font-semibold text-muted-foreground">Pergunta {i + 1}</span>
            <button type="button" onClick={() => remove(i)} className="text-muted-foreground hover:text-destructive" aria-label="Remover">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          <Input
            value={p.enunciado}
            onChange={(e) => update(i, { enunciado: e.target.value })}
            placeholder="Escreva a pergunta"
          />

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={p.tipo}
              onChange={(e) => update(i, { tipo: e.target.value as PerguntaTipo })}
              className="rounded-md border border-input bg-card px-2 py-1.5 text-sm"
            >
              {PERGUNTA_TIPOS.map((t) => (
                <option key={t} value={t}>{PERGUNTA_TIPO_LABEL[t]}</option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input type="checkbox" checked={p.obrigatoria} onChange={(e) => update(i, { obrigatoria: e.target.checked })} />
              Obrigatória
            </label>
          </div>

          {p.tipo === "multipla_escolha" && (
            <div className="space-y-2">
              <Label className="text-xs">Opções</Label>
              {p.opcoes.map((o, oi) => (
                <div key={oi} className="flex gap-2">
                  <Input
                    value={o}
                    onChange={(e) => update(i, { opcoes: p.opcoes.map((x, xi) => (xi === oi ? e.target.value : x)) })}
                    placeholder={`Opção ${oi + 1}`}
                  />
                  {p.opcoes.length > 2 && (
                    <button type="button" onClick={() => update(i, { opcoes: p.opcoes.filter((_, xi) => xi !== oi) })} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              <Button type="button" variant="ghost" size="sm" onClick={() => update(i, { opcoes: [...p.opcoes, ""] })}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Opção
              </Button>
            </div>
          )}

          {p.tipo === "escala" && (
            <div className="flex items-center gap-3 text-sm">
              <Label className="text-xs">De</Label>
              <Input type="number" className="w-20" value={p.escala_min} onChange={(e) => update(i, { escala_min: Number(e.target.value) })} />
              <Label className="text-xs">até</Label>
              <Input type="number" className="w-20" value={p.escala_max} onChange={(e) => update(i, { escala_max: Number(e.target.value) })} />
            </div>
          )}
        </Card>
      ))}

      <Button type="button" variant="outline" onClick={() => setPerguntas((prev) => [...prev, nova()])}>
        <Plus className="mr-2 h-4 w-4" /> Adicionar pergunta
      </Button>

      <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={() => router.push("/pesquisas")}>Voltar</Button>
        <Button type="button" variant="secondary" onClick={salvar} disabled={pending}>
          {pending ? "Salvando..." : "Salvar rascunho"}
        </Button>
        <Button type="button" onClick={salvarEDisparar} disabled={pending} className="bg-emerald-600 text-white hover:bg-emerald-700">
          <Send className="mr-2 h-4 w-4" /> Disparar
        </Button>
      </div>

      <DispararModal
        open={dispararOpen}
        onOpenChange={setDispararOpen}
        pesquisaId={pesquisaId}
        opcoes={opcoesPublico}
      />
    </div>
  );
}
