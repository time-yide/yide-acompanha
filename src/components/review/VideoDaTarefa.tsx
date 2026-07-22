"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadVersao } from "./UploadVersao";
import { adicionarVideoAction } from "@/lib/review/tarefa-actions";
import { STATUS_LABEL } from "@/lib/review/schema";
import type { VideoDoBloco } from "@/lib/review/queries";
import type { UploadTus } from "@/lib/bunny/client";
import { Plus, Video, Play } from "lucide-react";

export function VideoDaTarefa({ taskId, videos, podeGerenciar }: { taskId: string; videos: VideoDoBloco[]; podeGerenciar: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [upload, setUpload] = useState<{ reviewId: string; upload: UploadTus } | null>(null);

  function adicionar() {
    start(async () => {
      const r = await adicionarVideoAction(taskId, `Vídeo ${videos.length + 1}`);
      if ("error" in r) { toast.error(r.error); return; }
      setUpload(r); router.refresh();
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
          <Link key={v.reviewId} href={`/audiovisual/review/${v.reviewId}`} className="flex items-center gap-3 rounded-lg border p-2 hover:bg-muted/40">
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
          </Link>
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
    </Card>
  );
}
