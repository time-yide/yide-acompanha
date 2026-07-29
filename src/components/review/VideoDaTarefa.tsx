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
import { Plus, Video, Play, Trash2, AlertTriangle, Loader2 } from "lucide-react";

/**
 * Uma linha de vídeo. Estado próprio (`imgErro`) pra detectar capa que não
 * carrega — cobre os vídeos quebrados ANTES do fix de status do Bunny, que
 * ficaram `pronto=true` sem `thumbnail.jpg` (capa preta que não toca).
 */
function VideoRow({
  v,
  onOpen,
  onRemove,
  removing,
  podeGerenciar,
}: {
  v: VideoDoBloco;
  onOpen: (id: string) => void;
  onRemove: (id: string) => void;
  removing: boolean;
  podeGerenciar: boolean;
}) {
  const [imgErro, setImgErro] = useState(false);
  const hasVersao = v.versaoAtualId !== null;
  // Falhou explicitamente (Bunny status 5/6) OU está "pronto" mas a capa não
  // carregou (vídeo quebrado legado, sem thumbnail no Bunny).
  const falhou = v.falhouAtual || (v.prontoAtual && hasVersao && imgErro);
  const processando = hasVersao && !v.prontoAtual && !v.falhouAtual;

  return (
    // overflow-hidden: em card estreito o conteúdo não vaza por cima da coluna
    // da lixeira. items-stretch dá altura total ao divisor.
    <div className="flex items-stretch overflow-hidden rounded-lg border">
      <button
        type="button"
        onClick={() => onOpen(v.reviewId)}
        className="flex min-w-0 flex-1 items-center gap-3 p-2 text-left"
      >
        <span className="relative flex h-12 w-20 shrink-0 items-center justify-center overflow-hidden rounded bg-black">
          {v.prontoAtual && v.thumbUrl && !imgErro ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={v.thumbUrl}
              alt={v.titulo}
              onError={() => setImgErro(true)}
              className="h-full w-full object-cover opacity-80"
            />
          ) : null}
          {falhou ? (
            <AlertTriangle className="absolute h-5 w-5 text-red-400" />
          ) : processando ? (
            <Loader2 className="absolute h-4 w-4 animate-spin text-amber-400" />
          ) : (
            <Play className="absolute h-4 w-4 fill-white text-white" />
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="block truncate text-sm font-medium">{v.titulo}</span>
          {/* block + truncate: sem isso o status transbordava e ficava
              sobreposto ao botão "Review" em cards estreitos. */}
          <span
            className={`block truncate text-[11px] ${
              falhou
                ? "text-red-600 dark:text-red-400"
                : processando
                  ? "text-amber-600 dark:text-amber-400"
                  : v.status === "aprovado"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : v.status === "ajustes"
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-muted-foreground"
            }`}
          >
            {falhou ? "Falhou — reenviar" : processando ? "Processando…" : STATUS_LABEL[v.status]}
          </span>
        </span>
        <span className="shrink-0 self-center rounded-md border bg-muted/50 px-2 py-1 text-xs font-medium">Review</span>
      </button>
      {podeGerenciar && (
        // Lixeira é uma COLUNA própria à direita: divisor de altura total
        // (border-l) + largura fixa + fundo no hover deixam claro que é
        // um botão separado, sem cair em cima do "Review".
        <button
          type="button"
          onClick={() => onRemove(v.reviewId)}
          disabled={removing}
          title="Apagar vídeo"
          aria-label="Apagar vídeo"
          className="flex w-11 shrink-0 items-center justify-center border-l text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

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
          <VideoRow
            key={v.reviewId}
            v={v}
            onOpen={setReviewOpen}
            onRemove={remover}
            removing={removingId === v.reviewId}
            podeGerenciar={podeGerenciar}
          />
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
