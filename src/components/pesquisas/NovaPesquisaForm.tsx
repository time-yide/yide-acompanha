"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { createPesquisaAction } from "@/lib/pesquisas/actions";

export function NovaPesquisaForm() {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [anonima, setAnonima] = useState(false);
  const [resultadosPublicos, setResultadosPublicos] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (titulo.trim().length < 2) {
      toast.error("Dê um título à pesquisa");
      return;
    }
    const fd = new FormData();
    fd.set("titulo", titulo);
    fd.set("descricao", descricao);
    fd.set("anonima", anonima ? "true" : "false");
    fd.set("resultados_publicos", resultadosPublicos ? "true" : "false");
    startTransition(async () => {
      // createPesquisaAction redireciona pro construtor em caso de sucesso.
      const r = await createPesquisaAction(fd);
      if (r?.error) toast.error(r.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="titulo">Título</Label>
        <Input id="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Clima da equipe — Julho" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="descricao">Descrição (opcional)</Label>
        <Textarea id="descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} placeholder="Contexto pra quem vai responder" />
      </div>
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">Respostas anônimas</p>
          <p className="text-xs text-muted-foreground">Você vê só o resultado agregado, sem ligar a resposta à pessoa.</p>
        </div>
        <Switch checked={anonima} onCheckedChange={setAnonima} />
      </div>
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">Liberar resultados pro time</p>
          <p className="text-xs text-muted-foreground">O time todo vê os resultados agregados (sem nomes). Desligado = só a gestão vê.</p>
        </div>
        <Switch checked={resultadosPublicos} onCheckedChange={setResultadosPublicos} />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Criando..." : "Criar e adicionar perguntas"}
        </Button>
      </div>
    </form>
  );
}
