"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, Download, FileAudio, Loader2, AlertTriangle } from "lucide-react";
import { formatDuracao, formatTimestamp } from "@/lib/reunioes/tipos";

/** Só os campos que o player usa — serve tanto o detalhe interno quanto o
 *  DTO "versão cliente" do portal. */
interface RecordingLite {
  audio_url: string | null;
  duracao_segundos: number | null;
  formato: string | null;
  size_bytes: number | null;
}

interface Props {
  recording: RecordingLite | null;
  meetingId: string;
  /** Action que gera a URL assinada (checa permissão). Interno e portal do
   *  cliente passam actions diferentes — desacopla o player da permissão. */
  fetchUrlAction: (meetingId: string) => Promise<{ url: string } | { error: string }>;
}

/**
 * Player de áudio da gravação. `recording.audio_url` guarda o CAMINHO no bucket
 * (privado), não uma URL tocável — a URL assinada vem de `fetchUrlAction` (que
 * também checa permissão). Buscamos essa URL ao montar, então o play() roda no
 * gesto do clique (sem bloqueio de autoplay).
 */
export function RecordingPlayer({ recording, meetingId, fetchUrlAction }: Props) {
  const temGravacao = !!recording?.audio_url;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [src, setSrc] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // Já começa carregando quando há gravação (evita setState síncrono no effect).
  const [carregando, setCarregando] = useState(temGravacao);

  // Busca a URL assinada ao montar (só se há gravação). Todos os setState ficam
  // nos callbacks (async), não no corpo do effect.
  useEffect(() => {
    if (!temGravacao) return;
    let alive = true;
    fetchUrlAction(meetingId)
      .then((r) => {
        if (!alive) return;
        if ("error" in r) setErro(r.error);
        else setSrc(r.url);
      })
      .catch(() => { if (alive) setErro("Falha ao carregar a gravação."); })
      .finally(() => { if (alive) setCarregando(false); });
    return () => { alive = false; };
  }, [meetingId, temGravacao, fetchUrlAction]);

  if (!recording || !recording.audio_url) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 p-6 text-center">
        <FileAudio className="mx-auto h-8 w-8 text-muted-foreground/40" />
        <p className="mt-2 text-sm font-medium">Sem gravação disponível</p>
        <p className="mt-1 text-xs text-muted-foreground">
          A gravação aparece aqui quando a reunião é capturada.
        </p>
      </div>
    );
  }

  const totalSec = recording.duracao_segundos ?? 0;
  const currentSec = (progress / 100) * totalSec;

  function togglePlay() {
    const el = audioRef.current;
    if (!el || !src) return;
    if (playing) {
      el.pause();
    } else {
      // play() roda no gesto do clique (src já carregado no mount).
      el.play().catch(() => {
        setErro("Seu navegador não conseguiu tocar este áudio (formato WEBM). Baixe o arquivo para ouvir.");
        setPlaying(false);
      });
    }
  }

  return (
    <div className="rounded-xl border bg-gradient-to-br from-card to-muted/30 p-4">
      <audio
        ref={audioRef}
        src={src ?? undefined}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          if (el.duration) setProgress((el.currentTime / el.duration) * 100);
        }}
        onEnded={() => setPlaying(false)}
        onError={() => {
          if (src) setErro("Não foi possível carregar o áudio. Tente baixar o arquivo.");
        }}
        className="hidden"
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          disabled={carregando || !src}
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
          aria-label={playing ? "Pausar" : "Tocar"}
        >
          {carregando ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : playing ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5 translate-x-0.5" />
          )}
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
            {src && (
              <a
                href={src}
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

      {erro && (
        <p className="mt-3 flex items-start gap-1.5 rounded-md bg-destructive/10 p-2 text-[11px] text-destructive">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
          <span>{erro}</span>
        </p>
      )}
    </div>
  );
}
