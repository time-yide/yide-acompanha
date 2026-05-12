// Whisper / OpenAI transcription provider — STUB pra Fase 2.
//
// Decisão de produto: Whisper API é barato (~$0.006/min) mas NÃO faz
// diarização (separar quem falou). Se precisar diarização nativa,
// trocar pra AssemblyAI ou Deepgram.
//
// Pra MVP: Whisper transcreve, depois Claude faz "speaker attribution"
// olhando contexto (custa mais um round-trip mas funciona). Alternativa
// melhor: pra reuniões com video, podemos detectar quem falou pela
// imagem do Meet — mas isso é muito mais complexo, deixar pra Fase 4+.
//
// Variáveis .env:
//   OPENAI_API_KEY=sk-...

import type { TranscriptSegment } from "../tipos";

export interface TranscriptionResult {
  /** Texto contínuo. */
  texto_completo: string;
  /** Segmentos com timestamps. Speaker pode estar genérico ("Speaker 1") se diarização não foi feita. */
  segments: TranscriptSegment[];
  idioma: string;
  /** Estimativa de custo em centavos (US$). */
  custo_estimado_centavos: number;
  provider: "whisper" | "assemblyai" | "deepgram";
  modelo: string;
}

export interface TranscribeOptions {
  /** URL pública do áudio (Supabase Storage ou S3). */
  audioUrl: string;
  /** Idioma esperado — Whisper auto-detecta mas com hint fica melhor. */
  idioma?: string;
  /** Diarização: nem todos os providers suportam. */
  diarizar?: boolean;
}

export async function transcribeAudio(_opts: TranscribeOptions): Promise<TranscriptionResult> {
  void _opts;
  throw new Error("Transcrição ainda não implementada — Fase 2 do roadmap.");
}
