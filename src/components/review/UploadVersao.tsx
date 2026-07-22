"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as tus from "tus-js-client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Upload, Loader2 } from "lucide-react";
import { confirmarProntoAction } from "@/lib/review/actions";
import type { UploadTus } from "@/lib/bunny/client";

export function UploadVersao({ reviewId, upload, titulo }: { reviewId: string; upload: UploadTus; titulo: string }) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [prog, setProg] = useState<number | null>(null);

  function enviar(file: File) {
    setProg(0);
    const up = new tus.Upload(file, {
      endpoint: upload.endpoint,
      retryDelays: [0, 3000, 6000],
      headers: {
        AuthorizationSignature: upload.signature,
        AuthorizationExpire: String(upload.expiration),
        VideoId: upload.videoId,
        LibraryId: upload.libraryId,
      },
      metadata: { filetype: file.type, title: titulo },
      onError: () => { setProg(null); toast.error("Falha no upload."); },
      onProgress: (sent, total) => setProg(Math.round((sent / total) * 100)),
      onSuccess: async () => {
        setProg(null);
        toast.success("Enviado! Processando o vídeo…");
        // Poll status até ficar pronto (até ~2 min).
        for (let i = 0; i < 40; i++) {
          const r = await confirmarProntoAction(reviewId, upload.videoId);
          if (!("error" in r) && r.pronto) break;
          await new Promise((res) => setTimeout(res, 3000));
        }
        router.refresh();
      },
    });
    up.start();
  }

  return (
    <div>
      <input ref={ref} type="file" accept="video/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) enviar(f); }} disabled={prog !== null} />
      <Button type="button" onClick={() => ref.current?.click()} disabled={prog !== null}>
        {prog !== null ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
        {prog !== null ? `Enviando ${prog}%` : "Enviar vídeo"}
      </Button>
    </div>
  );
}
