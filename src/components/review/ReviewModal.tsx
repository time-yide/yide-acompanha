"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { carregarReviewAction } from "@/lib/review/tarefa-actions";
import { ReviewView } from "./ReviewView";
import type { ReviewFull } from "@/lib/review/queries";

type Loaded = { review: ReviewFull; podeGerenciar: boolean; podeAprovar: boolean };

/**
 * Abre o Frame (player + comentários) num modal, dentro da tarefa. Carrega os
 * dados do review ao abrir (server action). Estado guarda o reviewId junto pra
 * não mostrar dado velho ao trocar de vídeo. Sem setState síncrono em effect.
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

  const data = state && state.reviewId === reviewId ? state.data : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[88vh] w-[96vw] max-w-4xl overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="sr-only">
          <DialogTitle>Review do vídeo</DialogTitle>
        </DialogHeader>
        {!data ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando review…
          </div>
        ) : (
          <ReviewView review={data.review} podeGerenciar={data.podeGerenciar} podeAprovar={data.podeAprovar} />
        )}
      </DialogContent>
    </Dialog>
  );
}
