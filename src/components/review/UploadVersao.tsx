"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Upload, Loader2 } from "lucide-react";
import { confirmarProntoAction } from "@/lib/review/actions";
import { uploadVideoTus } from "@/lib/review/upload-tus";
import type { UploadTus } from "@/lib/bunny/client";

export function UploadVersao({ reviewId, upload, titulo }: { reviewId: string; upload: UploadTus; titulo: string }) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [prog, setProg] = useState<number | null>(null);

  async function enviar(file: File) {
    setProg(0);
    try {
      await uploadVideoTus(file, upload, titulo, setProg);
    } catch {
      setProg(null);
      toast.error("Falha no upload.");
      return;
    }
    setProg(null);
    toast.success("Enviado! Processando o vídeo…");
    // Poll status até ficar pronto (até ~2 min).
    for (let i = 0; i < 40; i++) {
      const r = await confirmarProntoAction(reviewId, upload.videoId);
      if (!("error" in r) && r.pronto) break;
      await new Promise((res) => setTimeout(res, 3000));
    }
    router.refresh();
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
