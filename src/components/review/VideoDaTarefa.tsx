"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadVersao } from "./UploadVersao";
import { ReviewModal } from "./ReviewModal";
import { adicionarVideoAction, removerVideoAction } from "@/lib/review/tarefa-actions";
import { STATUS_LABEL } from "@/lib/review/schema";
import type { VideoDoBloco } from "@/lib/review/queries";
import type { UploadTus } from "@/lib/bunny/client";
import { Plus, Video, Play, Trash2 } from "lucide-react";

export function VideoDaTarefa({ taskId, videos, podeGerenciar }: { taskId: string; videos: VideoDoBloco[]; podeGerenciar: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [upload, setUpload] = useState<{ reviewId: string; upload: UploadTus } | null>(null);
  const [reviewOpen, setReviewOpen] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  function adicionar() {
    start(async () => {
      const r = await adicionarVideoAction(taskId, `Vídeo ${videos.length + 1}`);
      if ("error" in r) { toast.error(r.error); return; }
      setUpload(r); router.refresh();
    });
  }

  function remover(reviewId: string) {
    if (!window.confirm("Apagar este vídeo? Os comentários dele também serão removidos.")) return;
    setRemovingId(reviewId);
    start(async () => {
      const r = await removerVideoAction(reviewId);
      setRemovingId(null);
      if ("error" in r) { toast.error(r.error); return; }
      toast.success("Vídeo removido");
      router.refresh();
    });
  }

  const aprovados = videos.filter((v) => v.status === "aprovado").length;

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-medium"><Video className="h-4 w-4" />Vídeos (Frame)</p>
        {videos.length > 0 && <span className="text-xs text-muted-foreground">{aprovados}/{videos.length} aprovados</span>}
      </div>

      {videos.length === 0 && !upload && (
        <p className="text-xs text-muted-foreground">Nenhum vídeo ainda.</p>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {videos.map((v) => (
          <div key={v.reviewId} className="flex items-center gap-2 rounded-lg border p-2">
            <button
              type="button"
              onClick={() => setReviewOpen(v.reviewId)}
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
              <span className="relative flex h-12 w-20 shrink-0 items-center justify-center overflow-hidden rounded bg-black">
                {v.thumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.thumbUrl} alt={v.titulo} className="h-full w-full object-cover opacity-80" />
                ) : null}
                <Play className="absolute h-4 w-4 fill-white text-white" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{v.titulo}</span>
                <span className={`text-[11px] ${v.status === "aprovado" ? "text-emerald-600 dark:text-emerald-400" : v.status === "ajustes" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                  {STATUS_LABEL[v.status]}
                </span>
              </span>
              <span className="shrink-0 rounded-md border px-2 py-1 text-xs font-medium">Review</span>
            </button>
            {podeGerenciar && (
              <button
                type="button"
                onClick={() => remover(v.reviewId)}
                disabled={removingId === v.reviewId}
                title="Apagar vídeo"
                className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      {podeGerenciar && (upload ? (
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="mb-2 text-xs text-muted-foreground">Envie o arquivo do vídeo:</p>
          <UploadVersao reviewId={upload.reviewId} upload={upload.upload} titulo="video" />
          <Link href={`/audiovisual/review/${upload.reviewId}`} className="mt-2 inline-block text-xs text-primary hover:underline">Abrir o vídeo →</Link>
        </div>
      ) : (
        <Button type="button" size="sm" variant="outline" onClick={adicionar} disabled={pending}><Plus className="mr-2 h-4 w-4" />Adicionar vídeo</Button>
      ))}

      <ReviewModal
        reviewId={reviewOpen ?? ""}
        open={reviewOpen !== null}
        onOpenChange={(o) => { if (!o) setReviewOpen(null); }}
      />
    </Card>
  );
}
