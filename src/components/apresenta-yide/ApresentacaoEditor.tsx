"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SlidePreview } from "./SlidePreview";
import { EditSlideDialog } from "./EditSlideDialog";
import type { Slide } from "@/lib/apresenta-yide/tipos";

interface Props {
  slides: Slide[];
  titulo: string;
  editable?: boolean;
  apresentacaoId?: string;
}

/**
 * View de apresentação existente — exibe os slides na coluna direita,
 * com navegação prev/next + miniatura de paginação. Coluna esquerda
 * mostra metadados (PR 1 estático; PR 2 vai ter timeline do streaming).
 */
export function ApresentacaoEditor({ slides, titulo, editable = false, apresentacaoId }: Props) {
  const [rawIdx, setRawIdx] = useState(0);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const total = slides.length;
  // Derive idx during render — keeps view valid when a slide is deleted and
  // rawIdx falls out of range. Avoids setState-in-effect.
  const idx = total > 0 ? Math.min(rawIdx, total - 1) : 0;
  const setIdx: typeof setRawIdx = setRawIdx;

  if (total === 0) {
    return (
      <div className="rounded-2xl border border-dashed bg-muted/10 px-6 py-16 text-center text-sm text-muted-foreground">
        Esta apresentação ainda não tem slides.
      </div>
    );
  }

  const current = slides[idx];

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{titulo}</h2>
          <p className="text-xs text-muted-foreground">
            Slide {idx + 1} de {total}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {editable && apresentacaoId && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditingIdx(idx)}
              aria-label="Editar slide atual"
            >
              <Edit2 className="mr-1.5 h-3.5 w-3.5" />
              Editar
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={idx === 0}
            aria-label="Slide anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIdx((i) => Math.min(total - 1, i + 1))}
            disabled={idx === total - 1}
            aria-label="Próximo slide"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="overflow-hidden rounded-xl border bg-black shadow-2xl">
        <SlidePreview slide={current} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIdx(i)}
            className={`h-1.5 flex-1 min-w-[16px] rounded-full transition-colors ${
              i === idx ? "bg-primary" : "bg-muted hover:bg-muted-foreground/40"
            }`}
            aria-label={`Ir pro slide ${i + 1}`}
          />
        ))}
      </div>

      {editable && apresentacaoId && editingIdx !== null && slides[editingIdx] && (
        <EditSlideDialog
          apresentacaoId={apresentacaoId}
          slideIndex={editingIdx}
          slide={slides[editingIdx]}
          totalSlides={total}
          onClose={() => setEditingIdx(null)}
        />
      )}
    </div>
  );
}
