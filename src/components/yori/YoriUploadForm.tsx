"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2 } from "lucide-react";
import { createYoriJobAction } from "@/lib/yori/actions";
import type { YoriTemplate } from "@/lib/yori/tipos";
import { YoriTemplatePicker } from "./YoriTemplatePicker";

interface Props {
  templates: YoriTemplate[];
}

interface VideoMetadata {
  file: File;
  durationSeconds: number;
  sizeBytes: number;
}

const MAX_DURATION_S = 90;
const MAX_SIZE_BYTES = 200 * 1024 * 1024;

async function readVideoMetadata(file: File): Promise<VideoMetadata | { error: string }> {
  if (file.size > MAX_SIZE_BYTES) {
    return { error: `Arquivo maior que ${(MAX_SIZE_BYTES / 1024 / 1024).toFixed(0)}MB` };
  }
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = Math.ceil(video.duration);
      URL.revokeObjectURL(video.src);
      if (duration > MAX_DURATION_S) {
        resolve({ error: `Vídeo tem ${duration}s. Máximo: ${MAX_DURATION_S}s.` });
        return;
      }
      resolve({ file, durationSeconds: duration, sizeBytes: file.size });
    };
    video.onerror = () => resolve({ error: "Arquivo não reconhecido como vídeo" });
    video.src = URL.createObjectURL(file);
  });
}

export function YoriUploadForm({ templates }: Props) {
  const router = useRouter();
  const [video, setVideo] = useState<VideoMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string>(templates[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    const result = await readVideoMetadata(file);
    if ("error" in result) {
      setError(result.error);
      setVideo(null);
      return;
    }
    setVideo(result);
  }

  function handleSubmit() {
    if (!video || !templateId) return;
    setError(null);

    const fd = new FormData();
    fd.set("video", video.file);
    fd.set("video_filename", video.file.name);
    fd.set("video_duration_seconds", String(video.durationSeconds));
    fd.set("video_size_bytes", String(video.sizeBytes));
    fd.set("template_id", templateId);

    startTransition(async () => {
      const r = await createYoriJobAction(fd);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      if (r.success && r.data) {
        router.push(`/audiovisual/yori/${r.data.jobId}`);
      }
    });
  }

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
        <Upload className="h-8 w-8 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium">
          {video ? video.file.name : "Arraste o vídeo aqui ou clique pra escolher"}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          MP4 até 200MB e até 90 segundos
          {video && ` · ${video.durationSeconds}s · ${(video.sizeBytes / 1024 / 1024).toFixed(1)}MB`}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/quicktime"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
          className="hidden"
        />
      </div>

      <div>
        <p className="text-xs font-medium mb-2">Escolha o template</p>
        <YoriTemplatePicker templates={templates} selectedId={templateId} onSelect={setTemplateId} />
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <button
        type="button"
        disabled={!video || !templateId || pending}
        onClick={handleSubmit}
        className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {pending ? "Subindo..." : "Gerar"}
      </button>
    </div>
  );
}
