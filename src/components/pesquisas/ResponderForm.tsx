"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { responderPesquisaAction } from "@/lib/pesquisas/actions";
import type { PerguntaRow } from "@/lib/pesquisas/schema";

export function ResponderForm({
  pesquisaId,
  titulo,
  descricao,
  perguntas,
}: {
  pesquisaId: string;
  titulo: string;
  descricao: string | null;
  perguntas: PerguntaRow[];
}) {
  const router = useRouter();
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [enviado, setEnviado] = useState(false);
  const [pending, startTransition] = useTransition();

  function set(pid: string, val: string) {
    setRespostas((prev) => ({ ...prev, [pid]: val }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    for (const p of perguntas) {
      if (p.obrigatoria && !respostas[p.id]) {
        toast.error("Responda todas as perguntas obrigatórias");
        return;
      }
    }
    const fd = new FormData();
    fd.set("pesquisa_id", pesquisaId);
    for (const [pid, val] of Object.entries(respostas)) {
      if (val !== "") fd.set(`pergunta_${pid}`, val);
    }
    startTransition(async () => {
      const r = await responderPesquisaAction(fd);
      if (r?.error) {
        toast.error(r.error);
        return;
      }
      setEnviado(true);
    });
  }

  if (enviado) {
    return (
      <Card className="flex flex-col items-center gap-3 p-10 text-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-600" />
        <p className="text-lg font-medium">Resposta enviada. Obrigada!</p>
        <Button variant="outline" onClick={() => router.push("/pesquisas")}>Voltar</Button>
      </Card>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{titulo}</h1>
        {descricao && <p className="text-sm text-muted-foreground">{descricao}</p>}
      </div>

      {perguntas.map((p, i) => (
        <Card key={p.id} className="space-y-3 p-4">
          <p className="text-sm font-medium">
            {i + 1}. {p.enunciado}
            {p.obrigatoria && <span className="text-destructive"> *</span>}
          </p>

          {p.tipo === "multipla_escolha" && (
            <div className="space-y-1.5">
              {(p.opcoes ?? []).map((o) => (
                <label key={o} className="flex items-center gap-2 text-sm">
                  <input type="radio" name={p.id} checked={respostas[p.id] === o} onChange={() => set(p.id, o)} />
                  {o}
                </label>
              ))}
            </div>
          )}

          {p.tipo === "escala" && (
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: (p.escala_max ?? 5) - (p.escala_min ?? 1) + 1 }, (_, k) => (p.escala_min ?? 1) + k).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => set(p.id, String(n))}
                  className={`h-9 w-9 rounded-full border text-sm ${respostas[p.id] === String(n) ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                >
                  {n}
                </button>
              ))}
            </div>
          )}

          {p.tipo === "sim_nao" && (
            <div className="flex gap-2">
              {[
                { v: "true", l: "Sim" },
                { v: "false", l: "Não" },
              ].map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => set(p.id, opt.v)}
                  className={`rounded-md border px-4 py-1.5 text-sm ${respostas[p.id] === opt.v ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}
                >
                  {opt.l}
                </button>
              ))}
            </div>
          )}

          {p.tipo === "texto" && (
            <Textarea value={respostas[p.id] ?? ""} onChange={(e) => set(p.id, e.target.value)} rows={3} placeholder="Sua resposta" />
          )}
        </Card>
      ))}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>{pending ? "Enviando..." : "Enviar respostas"}</Button>
      </div>
    </form>
  );
}
