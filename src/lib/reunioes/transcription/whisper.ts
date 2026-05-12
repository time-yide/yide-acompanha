// Whisper transcription — Fase 2 com Groq como provider default.
//
// Provider selection (em ordem de prioridade):
//   1. GROQ_API_KEY presente → Groq Whisper Large v3 Turbo
//      ($0.04/h, ~9× mais barato que OpenAI, mesma qualidade)
//   2. OPENAI_API_KEY presente → OpenAI Whisper-1 ($0.36/h)
//   3. Nenhuma → erro descritivo
//
// Override manual via REUNIOES_TRANSCRIPTION_PROVIDER=groq|openai
//
// Por que Groq:
//   - Endpoint OpenAI-compatible (mesmo schema multipart)
//   - Modelo whisper-large-v3-turbo: $0.04/hora (vs $0.36 OpenAI)
//   - Latência 5-10× menor (Groq LPUs são absurdamente rápidas)
//   - Mesma precisão pra pt-BR
//
// Variáveis .env:
//   GROQ_API_KEY=gsk_...                          (primary, mais barato)
//   OPENAI_API_KEY=sk-...                         (fallback)
//   REUNIOES_TRANSCRIPTION_PROVIDER=groq|openai   (opcional, força provider)
//   GROQ_WHISPER_MODEL=whisper-large-v3-turbo     (opcional, alternativas:
//                                                  whisper-large-v3 — mais preciso
//                                                  mas 3× mais caro que turbo)

import type { TranscriptSegment } from "../tipos";

export interface TranscriptionResult {
  texto_completo: string;
  segments: TranscriptSegment[];
  idioma: string;
  /** Estimativa de custo em centavos (US$). */
  custo_estimado_centavos: number;
  /** Estimativa de custo em centavos (R$, taxa 5.5). */
  custo_estimado_brl_centavos: number;
  provider: "whisper" | "groq-whisper" | "assemblyai" | "deepgram";
  modelo: string;
}

export interface TranscribeOptions {
  /** URL pública (signed) do áudio. */
  audioUrl: string;
  /** Idioma esperado — Whisper auto-detecta mas com hint fica melhor. */
  idioma?: string;
  /** Tamanho do arquivo em bytes — pra validação prévia. */
  sizeBytes?: number;
}

interface WhisperVerboseResponse {
  task: string;
  language: string;
  duration: number;
  text: string;
  segments: Array<{
    id: number;
    seek: number;
    start: number;
    end: number;
    text: string;
    tokens?: number[];
    temperature?: number;
    avg_logprob?: number;
    compression_ratio?: number;
    no_speech_prob?: number;
  }>;
}

interface ProviderConfig {
  name: "groq" | "openai";
  apiKey: string;
  baseUrl: string;
  model: string;
  /** Custo em USD por MINUTO de áudio. */
  costPerMinUsd: number;
  /** Label legível pra logs/telemetria. */
  providerLabel: "groq-whisper" | "whisper";
}

const WHISPER_LIMIT_BYTES = 25 * 1024 * 1024;

/**
 * Escolhe provider baseado em env vars. Prioridade Groq > OpenAI.
 * Override manual via REUNIOES_TRANSCRIPTION_PROVIDER.
 */
function selectProvider(): ProviderConfig | null {
  const forced = process.env.REUNIOES_TRANSCRIPTION_PROVIDER?.toLowerCase();
  const groqKey = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (forced === "groq" && groqKey) return buildGroqConfig(groqKey);
  if (forced === "openai" && openaiKey) return buildOpenAIConfig(openaiKey);

  // Default: Groq se tem key, senão OpenAI
  if (!forced || forced === "") {
    if (groqKey) return buildGroqConfig(groqKey);
    if (openaiKey) return buildOpenAIConfig(openaiKey);
  }

  return null;
}

function buildGroqConfig(apiKey: string): ProviderConfig {
  return {
    name: "groq",
    apiKey,
    baseUrl: "https://api.groq.com/openai/v1",
    model: process.env.GROQ_WHISPER_MODEL ?? "whisper-large-v3-turbo",
    // Groq Whisper Large v3 Turbo: $0.04/hora = $0.00067/min
    costPerMinUsd: 0.04 / 60,
    providerLabel: "groq-whisper",
  };
}

function buildOpenAIConfig(apiKey: string): ProviderConfig {
  return {
    name: "openai",
    apiKey,
    baseUrl: "https://api.openai.com/v1",
    model: "whisper-1",
    // OpenAI Whisper: $0.006/minuto
    costPerMinUsd: 0.006,
    providerLabel: "whisper",
  };
}

/**
 * Heurística simples de diarização (Whisper não faz nativo).
 * Alterna "Speaker 1" / "Speaker 2" sempre que gap entre segmentos > 1.5s.
 * Funciona bem pra 2 pessoas; Claude faz attribution melhor na Fase 3.
 */
function inferSpeakers(
  segments: WhisperVerboseResponse["segments"],
): TranscriptSegment[] {
  if (segments.length === 0) return [];

  const SPEAKER_GAP_SECONDS = 1.5;
  let currentSpeakerIdx = 0;
  const speakerNames = ["Speaker 1", "Speaker 2"];
  const result: TranscriptSegment[] = [];

  let previousEnd = 0;
  let currentBucket: TranscriptSegment | null = null;

  for (const seg of segments) {
    const gap = seg.start - previousEnd;
    const isSpeakerChange = gap >= SPEAKER_GAP_SECONDS && previousEnd > 0;

    if (isSpeakerChange) {
      currentSpeakerIdx = (currentSpeakerIdx + 1) % speakerNames.length;
      if (currentBucket) {
        result.push(currentBucket);
        currentBucket = null;
      }
    }

    const speaker = speakerNames[currentSpeakerIdx];

    if (!currentBucket || currentBucket.speaker !== speaker) {
      if (currentBucket) result.push(currentBucket);
      currentBucket = {
        speaker,
        speaker_id: `inferred-${currentSpeakerIdx}`,
        start: seg.start,
        end: seg.end,
        text: seg.text.trim(),
      };
    } else {
      currentBucket.end = seg.end;
      currentBucket.text += ` ${seg.text.trim()}`;
    }

    previousEnd = seg.end;
  }

  if (currentBucket) result.push(currentBucket);
  return result;
}

export async function transcribeAudio(opts: TranscribeOptions): Promise<TranscriptionResult> {
  const provider = selectProvider();
  if (!provider) {
    throw new Error(
      "Nenhuma chave de transcrição configurada. Defina GROQ_API_KEY (recomendado, ~9× mais barato) " +
        "ou OPENAI_API_KEY nas variáveis de ambiente.",
    );
  }

  if (opts.sizeBytes && opts.sizeBytes > WHISPER_LIMIT_BYTES) {
    throw new Error(
      `Áudio tem ${(opts.sizeBytes / 1024 / 1024).toFixed(1)}MB — Whisper API limita 25MB. ` +
        `Comprima o arquivo (ex.: MP3 64kbps mono) ou divida em pedaços.`,
    );
  }

  // Baixa o áudio (Whisper API não aceita URL — precisa multipart upload)
  const audioRes = await fetch(opts.audioUrl);
  if (!audioRes.ok) {
    throw new Error(`Falha ao baixar áudio (${audioRes.status})`);
  }
  const audioBuffer = await audioRes.arrayBuffer();
  const actualSize = audioBuffer.byteLength;

  if (actualSize > WHISPER_LIMIT_BYTES) {
    throw new Error(
      `Áudio tem ${(actualSize / 1024 / 1024).toFixed(1)}MB após download — excede limite Whisper de 25MB.`,
    );
  }

  const urlPath = new URL(opts.audioUrl).pathname;
  const filename = urlPath.slice(urlPath.lastIndexOf("/") + 1) || "audio.mp3";

  const form = new FormData();
  form.append("file", new Blob([audioBuffer]), filename);
  form.append("model", provider.model);
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");
  if (opts.idioma) {
    const lang = opts.idioma.split("-")[0].toLowerCase();
    form.append("language", lang);
  }

  const r = await fetch(`${provider.baseUrl}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${provider.apiKey}` },
    body: form,
  });

  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(
      `${provider.name === "groq" ? "Groq" : "OpenAI"} Whisper falhou (${r.status}): ${body.slice(0, 500)}`,
    );
  }

  const data = (await r.json()) as WhisperVerboseResponse;

  const segments = inferSpeakers(data.segments ?? []);
  const duracaoMin = (data.duration ?? 0) / 60;
  const custoUsd = duracaoMin * provider.costPerMinUsd;
  const custoEstimadoCentavos = Math.max(0, Math.round(custoUsd * 100));
  const custoBrlCentavos = Math.max(0, Math.round(custoUsd * 5.5 * 100));

  return {
    texto_completo: data.text.trim(),
    segments,
    idioma: data.language ?? opts.idioma ?? "pt-BR",
    custo_estimado_centavos: custoEstimadoCentavos,
    custo_estimado_brl_centavos: custoBrlCentavos,
    provider: provider.providerLabel,
    modelo: provider.model,
  };
}

/**
 * Helper exportado pra UI / debug: retorna nome do provider ativo.
 * Retorna null se nenhum configurado.
 */
export function getActiveTranscriptionProvider(): {
  name: "groq" | "openai";
  model: string;
  costPerHourUsd: number;
  costPerHourBrl: number;
} | null {
  const p = selectProvider();
  if (!p) return null;
  const costHourUsd = p.costPerMinUsd * 60;
  return {
    name: p.name,
    model: p.model,
    costPerHourUsd: costHourUsd,
    costPerHourBrl: costHourUsd * 5.5,
  };
}
