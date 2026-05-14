"use client";

import { Sparkles, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { IA_PROVIDERS } from "@/lib/design/tipos";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function IaPlaceholderModal({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Geração de arte com IA
          </DialogTitle>
          <DialogDescription>
            A geração com IA chega na <strong>Fase 2</strong> desse módulo. Aqui ficam os
            provedores planejados. Quando você decidir, eu ativo conforme as env vars
            forem configuradas no Vercel.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          {IA_PROVIDERS.map((p) => (
            <div
              key={p.value}
              className="flex items-start gap-3 rounded-md border bg-muted/20 p-3"
            >
              <Zap className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{p.label}</span>
                  <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 text-[9px] text-amber-700 dark:text-amber-300">
                    Em breve
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Modelo padrão: <code>{p.modeloPadrao}</code>
                </p>
                <p className="text-[11px] text-foreground/80 mt-0.5">
                  ✦ {p.melhorPara}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-[11px]">
          <p className="font-semibold text-foreground mb-1">⚠️ Atenção:</p>
          <p className="text-muted-foreground">
            <strong>Claude (Anthropic)</strong> não gera imagens. Só faz texto e análise visual.
            Por isso não está na lista. As opções de geração real são as 4 acima.
          </p>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Quando ativar a Fase 2, o style guide do cliente vai automaticamente
          enriquecer o prompt enviado pra IA (paleta, fontes, mood, exemplos
          aprovados, etc.).
        </p>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Entendi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
