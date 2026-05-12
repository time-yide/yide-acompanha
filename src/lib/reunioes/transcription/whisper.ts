// Whisper / OpenAI transcription provider.
//
// Endpoint: POST https://api.openai.com/v1/audio/transcriptions
// Limite: arquivo até 25MB. Acima disso retornamos erro descritivo —
// futura fase pode adicionar chunking via ffmpeg server-side.
//
// Whisper NÃO faz diarização (separar speakers). Pra MVP retornamos
// segmentos com speaker "Speaker 1" / "Speaker 2" inferido por gap de
// tempo. Quando a Fase 3 entrar, Claude faz speaker attribution
// melhor baseado no contexto + lista de participantes da reunião.
//
// Custo: $0.006 por minuto de áudio.
//
// Variáveis .env:
//   OPENAI_API_KEY=sk-...

import type { TranscriptSegment } from "../tipos";

export interface TranscriptionResult {
  texto_completo: string;
  segments: TranscriptSegment[];
  idioma: string;
  custo_estimado_centavos: number;
  provider: "whisper";
  modelo: string;
}

export interface TranscribeOptions {
  /** URL pública (signed) do áudio. */
  audioUrl: string;
  /** Idioma esperado — Whisper auto-detecta mas com hint fica melhor. */
  idioma?: string;
  /** Tamanho do arquivo em bytes — pra validação prévia + custo estimate. */
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
    tokens: number[];
    temperature: number;
    avg_logprob: number;
    compression_ratio: number;
    no_speech_prob: number;
  }>;
}

const WHISPER_LIMIT_BYTES = 25 * 1024 * 1024;
const WHISPER_MODEL = "whisper-1";

/**
 * Heurística simples de diarização: divide segmentos consecutivos do Whisper
 * em "turnos" sempre que tem gap > 1.5s entre eles. Alterna entre
 * "Speaker 1" e "Speaker 2" — funciona razoavelmente bem em conversas
 * de 2 pessoas; pra 3+ a Fase 3 (Claude) faz attribution melhor.
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
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY não configurada");
  }

  if (opts.sizeBytes && opts.sizeBytes > WHISPER_LIMIT_BYTES) {
    throw new Error(
      `Áudio tem ${(opts.sizeBytes / 1024 / 1024).toFixed(1)}MB — Whisper API limita 25MB. ` +
        `Comprima o arquivo (ex.: MP3 64kbps mono) ou divida em pedaços.`,
    );
  }

  // Baixa o áudio (Whisper API não aceita URL — precisa multipart upload do binário)
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

  // Detecta nome de arquivo a partir da URL (querystring tira tudo)
  const urlPath = new URL(opts.audioUrl).pathname;
  const filename = urlPath.slice(urlPath.lastIndexOf("/") + 1) || "audio.mp3";

  const form = new FormData();
  form.append("file", new Blob([audioBuffer]), filename);
  form.append("model", WHISPER_MODEL);
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");
  if (opts.idioma) {
    // Whisper usa ISO 639-1: "pt", "en", etc. Extraímos da tag.
    const lang = opts.idioma.split("-")[0].toLowerCase();
    form.append("language", lang);
  }

  const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`Whisper API falhou (${r.status}): ${body.slice(0, 500)}`);
  }

  const data = (await r.json()) as WhisperVerboseResponse;

  const segments = inferSpeakers(data.segments ?? []);
  const duracaoMin = (data.duration ?? 0) / 60;
  const custoEstimadoCentavos = Math.round(duracaoMin * 0.6 * 100) / 100; // $0.006/min → centavos

  return {
    texto_completo: data.text.trim(),
    segments,
    idioma: data.language ?? opts.idioma ?? "pt-BR",
    custo_estimado_centavos: Math.max(0, Math.round(custoEstimadoCentavos)),
    provider: "whisper",
    modelo: WHISPER_MODEL,
  };
}
