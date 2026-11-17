import { getServerEnv } from "@/lib/env";
import { OPENAI_REALTIME_TOOLS } from "./types";
import type { AIVoiceConfig } from "./types";

const DEFAULT_MODEL = "gpt-4o-realtime-preview";

const LANGUAGE_WRAPPER = `\
IMPORTANTE — IDIOMA E SOTAQUE:
Você DEVE falar exclusivamente em português brasileiro natural e coloquial.
Pronúncia brasileira: o R inicial e RR soam como H aspirado (ex: "Rato" = "Hato", "carro" = "caHo").
Nunca use pronúncia de Portugal ou inglês. Fale como uma pessoa real de Cuiabá/São Paulo ligando pra um cliente.
Use contrações naturais (tá, né, pra, pro, tô, vou tá).
Evite frases longas ou formais demais — seja direta e simpática como numa conversa de verdade.

---

`;

export function getRealtimeWsUrl(): string {
  const model = getServerEnv().OPENAI_REALTIME_MODEL || DEFAULT_MODEL;
  return `wss://api.openai.com/v1/realtime?model=${model}`;
}

export function buildSessionUpdate(config: AIVoiceConfig) {
  return {
    type: "session.update",
    session: {
      modalities: ["text", "audio"],
      instructions: LANGUAGE_WRAPPER + config.system_prompt,
      voice: config.voz || "coral",
      input_audio_format: "g711_ulaw",
      output_audio_format: "g711_ulaw",
      input_audio_transcription: { model: "whisper-1" },
      turn_detection: {
        type: "server_vad",
        threshold: 0.5,
        silence_duration_ms: 800,
      },
      temperature: config.temperatura ?? 0.9,
      tools: OPENAI_REALTIME_TOOLS.map((t) => ({
        type: t.type,
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      })),
    },
  };
}
