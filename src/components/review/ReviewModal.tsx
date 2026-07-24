"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { carregarReviewAction } from "@/lib/review/tarefa-actions";
import { ReviewView } from "./ReviewView";
import type { ReviewFull } from "@/lib/review/queries";

type Loaded = { review: ReviewFull; podeGerenciar: boolean; podeAprovar: boolean };

/**
 * Abre o Frame (ReviewView) em TELA CHEIA, dentro da tarefa. O ReviewView já é
 * um overlay `fixed inset-0`; por isso NÃO usamos <Dialog> (o transform de
 * centralização do dialog quebra o position:fixed e espremia tudo numa
 * caixinha). Renderizamos via portal no body pra cobrir a viewport de verdade —
 * funciona inclusive por cima do preview da tarefa. O ← voltar fecha e volta
 * pra lista de vídeos.
 */
export function ReviewModal({
  reviewId,
  open,
  onOpenChange,
}: {
  reviewId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [state, setState] = useState<{ reviewId: string; data: Loaded } | null>(null);

  useEffect(() => {
    if (!open || !reviewId) return;
    let alive = true;
    (async () => {
      const r = await carregarReviewAction(reviewId);
      if (!alive) return;
      if ("error" in r) {
        toast.error(r.error);
        onOpenChange(false);
        return;
      }
      setState({ reviewId, data: r });
    })();
    return () => {
      alive = false;
    };
  }, [open, reviewId, onOpenChange]);

  // Esc fecha + trava o scroll do fundo enquanto o review tela-cheia está aberto.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onOpenChange]);

  if (!open) return null;
  const data = state && state.reviewId === reviewId ? state.data : null;

  return createPortal(
    !data ? (
      <div className="fixed inset-0 z-[70] flex items-center justify-center gap-2 bg-neutral-950 text-sm text-white/70">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando review…
      </div>
    ) : (
      <ReviewView
        review={data.review}
        podeGerenciar={data.podeGerenciar}
        podeAprovar={data.podeAprovar}
        onVoltar={() => onOpenChange(false)}
      />
    ),
    document.body,
  );
}
