"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2 } from "lucide-react";
import { criarJobAction } from "@/lib/editor-ia/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type VideoState =
  | { status: "idle" }
  | { status: "reading" }
  | { status: "ready"; file: File; durationSeconds: number; sizeBytes: number }
  | { status: "error"; message: string };

const MAX_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB

async function readVideoDuration(file: File): Promise<number | { error: string }> {
  if (file.size > MAX_SIZE_BYTES) {
    return { error: `Arquivo maior que ${(MAX_SIZE_BYTES / 1024 / 1024).toFixed(0)}MB` };
  }
  return new Promise((resolve) => {
    const el = document.createElement("video");
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      const duration = Math.ceil(el.duration);
      URL.revokeObjectURL(el.src);
      resolve(duration);
    };
    el.onerror = () => {
      URL.revokeObjectURL(el.src);
      resolve({ error: "Arquivo não reconhecido como vídeo" });
    };
    el.src = URL.createObjectURL(file);
  });
}

export function NovoJobForm() {
  const router = useRouter();
  const [videoState, setVideoState] = useState<VideoState>({ status: "idle" });
  const [instrucao, setInstrucao] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setVideoState({ status: "reading" });
    setSubmitError(null);

    const result = await readVideoDuration(file);
    if (typeof result === "object" && "error" in result) {
      setVideoState({ status: "error", message: result.error });
      return;
    }
    setVideoState({ status: "ready", file, durationSeconds: result, sizeBytes: file.size });
  }

  function handleSubmit() {
    if (videoState.status !== "ready") return;

    setSubmitError(null);
    const fd = new FormData();
    fd.set("video", videoState.file);
    fd.set("instrucao", instrucao);
    fd.set("video_duracao_segundos", String(videoState.durationSeconds));

    startTransition(async () => {
      const r = await criarJobAction(fd);
      if ("error" in r) {
        setSubmitError(r.error);
        return;
      }
      if (r.success) {
        router.push("/audiovisual/editor-ia");
      }
    });
  }

  const isReading = videoState.status === "reading";
  const isReady = videoState.status === "ready" && instrucao.trim().length > 0;

  return (
    <div className="space-y-4">
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) void handleFile(file);
        }}
        className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed bg-muted/20 p-8 cursor-pointer hover:bg-muted/30 transition-colors"
      >
        {videoState.status === "reading" ? (
          <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
        ) : (
          <Upload className="h-8 w-8 text-muted-foreground" />
        )}
        <p className="mt-2 text-sm font-medium">
          {videoState.status === "ready"
            ? videoState.file.name
            : videoState.status === "reading"
              ? "Lendo vídeo..."
              : "Arraste o vídeo aqui ou clique pra escolher"}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {videoState.status === "ready"
            ? `${videoState.durationSeconds}s · ${(videoState.sizeBytes / 1024 / 1024).toFixed(1)}MB`
            : "MP4, MOV, ou qualquer formato de vídeo"}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
          className="hidden"
        />
      </div>

      {videoState.status === "error" && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          {videoState.message}
        </div>
      )}

      <div className="space-y-1">
        <label className="text-xs font-medium text-foreground">Instrução de edição</label>
        <Textarea
          value={instrucao}
          onChange={(e) => setInstrucao(e.target.value)}
          placeholder="Ex.: corta os silencios e partes paradas, deixa dinamico, poe legenda"
          rows={4}
          disabled={pending}
        />
      </div>

      {submitError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          {submitError}
        </div>
      )}

      <Button
        type="button"
        disabled={!isReady || isReading || pending}
        onClick={handleSubmit}
        size="lg"
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Enviando...
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" />
            Gerar
          </>
        )}
      </Button>
    </div>
  );
}
