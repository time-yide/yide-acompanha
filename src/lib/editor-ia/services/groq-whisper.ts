// SERVER ONLY — Groq Whisper API wrapper.
//
// Docs: https://console.groq.com/docs/speech-to-text
// Modelo: whisper-large-v3 (rápido + barato, ~10x speed)
// Custo: ~US$0.005/min de áudio (~R$0.025/min)
//
// Sem GROQ_API_KEY → retorna { ok: false, skipped: true }.

import Groq from "groq-sdk";
import { getServerEnv } from "@/lib/env";
import type { WhisperTranscription, WhisperWord } from "../tipos";

const FETCH_TIMEOUT_MS = 120_000;

export interface WhisperResult {
  ok: boolean;
  skipped: boolean;
  error: string | null;
  transcription: WhisperTranscription | null;
  cost_brl: number;
}

const EMPTY: WhisperResult = {
  ok: false,
  skipped: false,
  error: null,
  transcription: null,
  cost_brl: 0,
};

/**
 * Transcreve um vídeo/áudio via Groq Whisper Large-v3 com timestamps por palavra.
 *
 * @param videoBuffer - buffer do arquivo (baixado do Supabase Storage)
 * @param filename - nome original (extensão importa pro Groq detectar formato)
 */
export async function transcribeAudio(
  videoBuffer: Buffer,
  filename: string,
): Promise<WhisperResult> {
  const env = getServerEnv();
  if (!env.GROQ_API_KEY) {
    return { ...EMPTY, skipped: true };
  }

  const client = new Groq({ apiKey: env.GROQ_API_KEY });

  try {
    const file = new File([new Uint8Array(videoBuffer)], filename, { type: "video/mp4" });
    const response = (await Promise.race([
      client.audio.transcriptions.create({
        file,
        model: "whisper-large-v3",
        response_format: "verbose_json",
        timestamp_granularities: ["word"],
        language: "pt",
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Groq timeout")), FETCH_TIMEOUT_MS),
      ),
    ])) as {
      text: string;
      language?: string;
      duration?: number;
      words?: Array<{ word: string; start: number; end: number }>;
    };

    const words: WhisperWord[] = (response.words ?? []).map((w) => ({
      word: w.word,
      start: w.start,
      end: w.end,
    }));

    const transcription: WhisperTranscription = {
      text: response.text,
      language: response.language ?? "pt",
      duration: response.duration ?? 0,
      words,
    };

    const cost_brl = (transcription.duration / 60) * 0.025;

    return {
      ok: true,
      skipped: false,
      error: null,
      transcription,
      cost_brl,
    };
  } catch (err) {
    console.warn("[groq-whisper] falhou:", err instanceof Error ? err.message : err);
    return {
      ...EMPTY,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
