"use client";

import { useRef, useState } from "react";

interface Props {
  voice: string;
}

export function VoicePreviewButton({ voice }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "playing" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function handlePlay() {
    if (status === "playing") {
      audioRef.current?.pause();
      setStatus("idle");
      return;
    }

    setStatus("loading");
    setErrorMsg("");
    try {
      const resp = await fetch(`/api/voz-ia/tts-preview?voice=${voice}`);
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        setErrorMsg(data.error ?? "Erro ao gerar áudio");
        setStatus("error");
        return;
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);

      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }

      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setStatus("idle");
      audio.play();
      setStatus("playing");
    } catch {
      setErrorMsg("Erro de conexão");
      setStatus("error");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handlePlay}
        disabled={status === "loading"}
        className="rounded-md border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
        title={status === "playing" ? "Parar" : "Ouvir voz"}
      >
        {status === "loading" ? "..." : status === "playing" ? "⏹" : "▶"}
      </button>
      {status === "error" && (
        <span className="text-xs text-red-500">{errorMsg}</span>
      )}
    </div>
  );
}
