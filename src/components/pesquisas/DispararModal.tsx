"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dispararPesquisaAction } from "@/lib/pesquisas/actions";

export interface PublicoOptions {
  cargos: { value: string; label: string }[];
  unidades: { id: string; nome: string }[];
  pessoas: { id: string; nome: string }[];
}

type Modo = "todos" | "cargos" | "unidade" | "pessoas";

export function DispararModal({
  open,
  onOpenChange,
  pesquisaId,
  opcoes,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pesquisaId: string;
  opcoes: PublicoOptions;
}) {
  const [modo, setModo] = useState<Modo>("todos");
  const [cargos, setCargos] = useState<Set<string>>(new Set());
  const [unidadeId, setUnidadeId] = useState("");
  const [pessoas, setPessoas] = useState<Set<string>>(new Set());
  const [prazo, setPrazo] = useState("");
  const [pending, startTransition] = useTransition();

  function toggle(set: Set<string>, val: string): Set<string> {
    const next = new Set(set);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    return next;
  }

  function disparar() {
    const fd = new FormData();
    fd.set("id", pesquisaId);
    fd.set("publico_modo", modo);
    if (modo === "cargos") cargos.forEach((c) => fd.append("cargos", c));
    if (modo === "unidade") fd.set("unidade_id", unidadeId);
    if (modo === "pessoas") pessoas.forEach((p) => fd.append("pessoas", p));
    if (prazo) fd.set("prazo", prazo);
    startTransition(async () => {
      // dispararPesquisaAction redireciona pra tela de resultados em caso de sucesso.
      const r = await dispararPesquisaAction(fd);
      if (r?.error) toast.error(r.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Disparar pesquisa</DialogTitle>
          <DialogDescription>Escolha quem recebe. Eles vão receber uma notificação pra responder.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Público</Label>
            <div className="flex flex-wrap gap-2">
              {(["todos", "cargos", "unidade", "pessoas"] as Modo[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setModo(m)}
                  className={`rounded-full border px-3 py-1 text-xs ${modo === m ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}
                >
                  {m === "todos" ? "Time todo" : m === "cargos" ? "Cargos" : m === "unidade" ? "Unidade" : "Pessoas"}
                </button>
              ))}
            </div>
          </div>

          {modo === "cargos" && (
            <div className="grid grid-cols-2 gap-1.5 rounded-md border p-2 max-h-48 overflow-y-auto">
              {opcoes.cargos.map((c) => (
                <label key={c.value} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={cargos.has(c.value)} onChange={() => setCargos((s) => toggle(s, c.value))} />
                  {c.label}
                </label>
              ))}
            </div>
          )}

          {modo === "unidade" && (
            <select
              value={unidadeId}
              onChange={(e) => setUnidadeId(e.target.value)}
              className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm"
            >
              <option value="">Selecione a unidade</option>
              {opcoes.unidades.map((u) => (
                <option key={u.id} value={u.id}>{u.nome}</option>
              ))}
            </select>
          )}

          {modo === "pessoas" && (
            <div className="grid grid-cols-2 gap-1.5 rounded-md border p-2 max-h-48 overflow-y-auto">
              {opcoes.pessoas.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={pessoas.has(p.id)} onChange={() => setPessoas((s) => toggle(s, p.id))} />
                  {p.nome}
                </label>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="prazo">Prazo (opcional)</Label>
            <Input id="prazo" type="datetime-local" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
            <p className="text-[11px] text-muted-foreground">Se preencher, a pesquisa encerra sozinha na data. Você também pode encerrar na mão.</p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancelar</Button>
          <Button type="button" onClick={disparar} disabled={pending}>
            {pending ? "Disparando..." : "Disparar agora"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
