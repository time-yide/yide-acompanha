"use client";

import { useRef, useState } from "react";
import { Play, Pause, Volume2, Download, FileAudio } from "lucide-react";
import { formatDuracao, formatTimestamp, type MeetingRecording } from "@/lib/reunioes/tipos";

interface Props {
  recording: MeetingRecording | null;
}

/**
 * Player de áudio simplificado. Quando o áudio real (mp3 URL do Storage)
 * entrar na Fase 2, basta apontar src pro audio_url. Por enquanto é mock -
 * play/pause funcionam visualmente mas não há áudio real.
 */
export function RecordingPlayer({ recording }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  if (!recording || !recording.audio_url) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 p-6 text-center">
        <FileAudio className="mx-auto h-8 w-8 text-muted-foreground/40" />
        <p className="mt-2 text-sm font-medium">Sem gravação disponível</p>
        <p className="mt-1 text-xs text-muted-foreground">
          A gravação aparece aqui quando o bot capturar a reunião (Fase 2 do roadmap).
        </p>
      </div>
    );
  }

  const totalSec = recording.duracao_segundos ?? 0;
  const currentSec = (progress / 100) * totalSec;

  function togglePlay() {
    const el = audioRef.current;
    if (!el) {
      // Mock - sem áudio real, só simula
      setPlaying((p) => !p);
      return;
    }
    if (playing) el.pause();
    else void el.play();
    setPlaying(!playing);
  }

  return (
    <div className="rounded-xl border bg-gradient-to-br from-card to-muted/30 p-4">
      <audio
        ref={audioRef}
        src={recording.audio_url}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          if (el.duration) setProgress((el.currentTime / el.duration) * 100);
        }}
        onEnded={() => setPlaying(false)}
        onError={() => {
          // mock mode: áudio falso, deixa o usuário "scrubbar" sem áudio real
        }}
        className="hidden"
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105"
          aria-label={playing ? "Pausar" : "Tocar"}
        >
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-0.5" />}
        </button>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <div className="text-xs font-medium">Gravação da reunião</div>
            <div className="font-mono text-[10px] tabular-nums text-muted-foreground">
              {formatTimestamp(currentSec)} / {formatDuracao(totalSec)}
            </div>
          </div>

          {/* Progress bar */}
          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="absolute inset-y-0 left-0 bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Volume2 className="h-3 w-3" />
              {recording.formato?.toUpperCase() ?? "MP3"}
              {recording.size_bytes && ` · ${(recording.size_bytes / 1024 / 1024).toFixed(1)} MB`}
            </span>
            {recording.audio_url && recording.audio_url.startsWith("http") && (
              <a
                href={recording.audio_url}
                download
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                <Download className="h-3 w-3" />
                Baixar
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
