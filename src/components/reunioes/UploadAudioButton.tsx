"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2, AlertCircle, CheckCircle2, X } from "lucide-react";
import {
  gerarUploadUrlAction,
  registrarUploadConcluidoAction,
} from "@/lib/reunioes/upload-actions";

interface Props {
  meetingId: string;
  /** Compacto: só mostra ícone + label discreto (pro header). */
  compact?: boolean;
}

const ALLOWED_EXTENSIONS = ".mp3,.m4a,.mp4,.wav,.webm,.ogg";
const WHISPER_MAX_MB = 25;

/**
 * Botão de upload de áudio. Fluxo:
 *  1. User escolhe arquivo
 *  2. Action gera signed upload URL → cliente faz PUT direto pro Supabase
 *  3. Cliente chama action de registrar → cria meeting_recordings + job
 *  4. Cron worker pega o job e transcreve
 *  5. router.refresh() → UI mostra status "processing"
 */
export function UploadAudioButton({ meetingId, compact }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [progress, setProgress] = useState<{ etapa: string; pct: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    setSuccess(null);
    inputRef.current?.click();
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input pra permitir re-upload do mesmo arquivo
    if (inputRef.current) inputRef.current.value = "";

    if (file.size > WHISPER_MAX_MB * 1024 * 1024) {
      setError(
        `Arquivo tem ${(file.size / 1024 / 1024).toFixed(1)}MB. Whisper limita 25MB. ` +
          `Sugestão: exporte como MP3 64kbps mono (cabe ~1h de áudio).`,
      );
      return;
    }

    startTransition(async () => {
      try {
        setProgress({ etapa: "Gerando link de upload…", pct: 5 });

        const urlRes = await gerarUploadUrlAction({
          meeting_id: meetingId,
          filename: file.name,
          mime_type: file.type || "audio/mpeg",
          size_bytes: file.size,
        });
        if ("error" in urlRes) {
          setError(urlRes.error);
          setProgress(null);
          return;
        }

        setProgress({ etapa: "Enviando áudio…", pct: 10 });

        // Upload direto pro Supabase via XHR (com progress)
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", urlRes.url);
          xhr.upload.onprogress = (ev) => {
            if (ev.lengthComputable) {
              const pct = Math.round(10 + (ev.loaded / ev.total) * 80);
              setProgress({ etapa: "Enviando áudio…", pct });
            }
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(`Upload falhou (${xhr.status}): ${xhr.responseText.slice(0, 200)}`));
          };
          xhr.onerror = () => reject(new Error("Erro de rede durante o upload"));
          xhr.setRequestHeader("Content-Type", file.type || "audio/mpeg");
          xhr.send(file);
        });

        setProgress({ etapa: "Registrando gravação…", pct: 92 });

        const regRes = await registrarUploadConcluidoAction({
          meeting_id: meetingId,
          path: urlRes.path,
          mime_type: file.type || "audio/mpeg",
          size_bytes: file.size,
          filename: file.name,
        });
        if ("error" in regRes) {
          setError(regRes.error);
          setProgress(null);
          return;
        }

        setProgress({ etapa: "Pronto! Transcrição iniciada.", pct: 100 });
        setSuccess("Áudio enviado. A transcrição começa em até 1 minuto.");
        setTimeout(() => {
          setProgress(null);
          router.refresh();
        }, 1500);
      } catch (e) {
        setError((e as Error).message);
        setProgress(null);
      }
    });
  }

  const isBusy = pending || progress !== null;

  if (compact) {
    return (
      <>
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_EXTENSIONS}
          onChange={handleChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={handleClick}
          disabled={isBusy}
          className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isBusy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          {isBusy ? progress?.etapa ?? "Enviando…" : "Subir áudio"}
        </button>
        {error && (
          <p className="mt-1 text-[11px] text-destructive max-w-xs">{error}</p>
        )}
      </>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_EXTENSIONS}
        onChange={handleChange}
        className="hidden"
      />
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-primary/10 p-2.5 shrink-0">
          <Upload className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm">Enviar áudio da reunião</p>
          <p className="text-xs text-muted-foreground">
            MP3 / M4A / WAV até 25MB. A IA transcreve e gera resumo + tarefas automaticamente.
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Dica: exporte em MP3 64kbps mono — cabe ~1h em 25MB.
          </p>
        </div>
        <button
          type="button"
          onClick={handleClick}
          disabled={isBusy}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {isBusy ? "Enviando…" : "Escolher arquivo"}
        </button>
      </div>

      {progress && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span>{progress.etapa}</span>
            <span className="font-mono tabular-nums">{progress.pct}%</span>
          </div>
          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="absolute inset-y-0 left-0 bg-primary transition-all"
              style={{ width: `${progress.pct}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-2.5 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} className="shrink-0">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {success && !progress && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-2.5 text-xs text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{success}</span>
        </div>
      )}
    </div>
  );
}
