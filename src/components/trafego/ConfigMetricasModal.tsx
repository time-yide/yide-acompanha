"use client";

import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { updateMetricasVisiveisAction } from "@/lib/trafego/actions";
import {
  METRICAS_DISPONIVEIS,
  METRICAS_DEFAULT,
  CATEGORIA_LABELS,
  type MetricaCategoria,
} from "@/lib/trafego/metricas";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: string[];
}

export function ConfigMetricasModal({ open, onOpenChange, initial }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initial));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selecionarKitPadrao() {
    setSelected(new Set(METRICAS_DEFAULT));
  }

  function desmarcarTudo() {
    setSelected(new Set());
  }

  function selecionarTudo() {
    setSelected(new Set(METRICAS_DISPONIVEIS.map((m) => m.key)));
  }

  function onSave() {
    setError(null);
    const fd = new FormData();
    fd.set("metricas", JSON.stringify([...selected]));
    startTransition(async () => {
      const r = await updateMetricasVisiveisAction(fd);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      onOpenChange(false);
    });
  }

  // Agrupa por categoria
  const porCategoria = new Map<MetricaCategoria, typeof METRICAS_DISPONIVEIS>();
  for (const m of METRICAS_DISPONIVEIS) {
    const arr = porCategoria.get(m.categoria) ?? [];
    arr.push(m);
    porCategoria.set(m.categoria, arr);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar métricas visíveis</DialogTitle>
          <DialogDescription>
            Marque as métricas que você quer ver na visualização de campanhas. Sua escolha é salva por usuário.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 border-b pb-3">
          <Button type="button" size="sm" variant="outline" onClick={selecionarKitPadrao}>
            Kit padrão (recomendado)
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={selecionarTudo}>
            Selecionar tudo ({METRICAS_DISPONIVEIS.length})
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={desmarcarTudo}>
            Desmarcar tudo
          </Button>
          <span className="ml-auto text-xs text-muted-foreground self-center">
            {selected.size} selecionada{selected.size === 1 ? "" : "s"}
          </span>
        </div>

        <div className="space-y-5">
          {([...porCategoria.entries()] as Array<[MetricaCategoria, typeof METRICAS_DISPONIVEIS]>).map(([cat, items]) => (
            <div key={cat} className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {CATEGORIA_LABELS[cat]}
              </h4>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {items.map((m) => {
                  const checked = selected.has(m.key);
                  return (
                    <label
                      key={m.key}
                      className="flex cursor-pointer items-start gap-2 rounded-md border bg-card p-2.5 hover:bg-muted/40"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggle(m.key)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{m.label}</span>
                          {m.plataforma === "meta" && (
                            <span className="rounded-full border border-blue-500/40 bg-blue-500/10 px-1.5 text-[9px] text-blue-700 dark:text-blue-300">
                              Meta
                            </span>
                          )}
                          {m.plataforma === "google" && (
                            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 text-[9px] text-amber-700 dark:text-amber-300">
                              Google
                            </span>
                          )}
                        </div>
                        {m.descricao && (
                          <p className="text-[10px] text-muted-foreground">{m.descricao}</p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button type="button" onClick={onSave} disabled={pending}>
            {pending ? "Salvando..." : "Salvar preferências"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
