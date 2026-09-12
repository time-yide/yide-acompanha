"use client";

import { useRef, useState } from "react";

interface Props {
  voice: string;
}

export function VoicePreviewButton({ voice }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "playing">("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function handlePlay() {
    if (status === "playing") {
      audioRef.current?.pause();
      setStatus("idle");
      return;
    }

    setStatus("loading");
    try {
      const resp = await fetch(`/api/voz-ia/tts-preview?voice=${voice}`);
      if (!resp.ok) throw new Error();
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
      setStatus("idle");
    }
  }

  return (
    <button
      type="button"
      onClick={handlePlay}
      disabled={status === "loading"}
      className="rounded-md border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
      title={status === "playing" ? "Parar" : "Ouvir voz"}
    >
      {status === "loading" ? "..." : status === "playing" ? "⏹" : "▶"}
    </button>
  );
}
