"use client";

import { useState, useTransition } from "react";
import { X, Loader2 } from "lucide-react";
import { atualizarSlideAction } from "@/lib/trafego/relatorios/actions";
import type { Slide } from "@/lib/trafego/relatorios/tipos";

interface Props {
  relatorioId: string;
  index: number;
  slide: Slide;
  onClose: () => void;
  onSaved: (s: Slide) => void;
}

// Editor genérico baseado em JSON cru. UI completa por template seria muito
// código pra v1 — assessor pode editar inline o JSON formatado. UX simples
// mas funcional. Futuras versões podem dar campos próprios por template.
export function SlideEditorInline({ relatorioId, index, slide, onClose, onSaved }: Props) {
  const [json, setJson] = useState(JSON.stringify(slide.content, null, 2));
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      setErro("JSON inválido");
      return;
    }
    if (!parsed || typeof parsed !== "object") {
      setErro("Conteúdo precisa ser um objeto");
      return;
    }

    const updated: Slide = { template: slide.template, content: parsed as Slide["content"] };

    const fd = new FormData();
    fd.set("id", relatorioId);
    fd.set("index", String(index));
    fd.set("slide", JSON.stringify(updated));

    startTransition(async () => {
      const r = await atualizarSlideAction(fd);
      if ("error" in r) setErro(r.error);
      else onSaved(updated);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-lg border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b p-3">
          <h3 className="text-sm font-semibold">
            Editar slide {index + 1} · {slide.template}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="space-y-3 p-4">
          <p className="text-xs text-muted-foreground">
            Edite o JSON do conteúdo. O <code>template</code> não pode mudar.
          </p>
          <textarea
            value={json}
            onChange={(e) => setJson(e.target.value)}
            rows={16}
            className="w-full rounded-md border bg-card p-2 font-mono text-xs"
          />
          {erro && (
            <p className="rounded-md border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-700 dark:text-red-300">
              {erro}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-md border bg-card px-3 text-sm hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
