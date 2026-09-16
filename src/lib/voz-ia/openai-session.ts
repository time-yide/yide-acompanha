import { getServerEnv } from "@/lib/env";
import { OPENAI_REALTIME_TOOLS } from "./types";
import type { AIVoiceConfig } from "./types";

const DEFAULT_MODEL = "gpt-4o-mini-realtime-preview";

export function getRealtimeWsUrl(): string {
  const model = getServerEnv().OPENAI_REALTIME_MODEL || DEFAULT_MODEL;
  return `wss://api.openai.com/v1/realtime?model=${model}`;
}

export function buildSessionUpdate(config: AIVoiceConfig) {
  return {
    type: "session.update",
    session: {
      modalities: ["text", "audio"],
      instructions: config.system_prompt,
      voice: config.voz || "coral",
      input_audio_format: "g711_ulaw",
      output_audio_format: "g711_ulaw",
      input_audio_transcription: { model: "whisper-1" },
      turn_detection: {
        type: "server_vad",
        threshold: 0.5,
        silence_duration_ms: 800,
      },
      temperature: config.temperatura ?? 0.8,
      tools: OPENAI_REALTIME_TOOLS.map((t) => ({
        type: t.type,
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      })),
    },
  };
}
