import type { WhisperWord } from "@/lib/yori/tipos";
import { groupWordsIntoLines } from "@/lib/yori/srt-builder";
import type { EditPlan, EditSegment, CaptionLine } from "../tipos";

export interface PlanoParams {
  /** Silêncio (gap entre palavras) a partir do qual o trecho é cortado. */
  silencioMinSegundos: number;
}

/** Deriva parâmetros do plano a partir da instrução em texto (heurística por keyword). */
export function parametrosDaInstrucao(instrucao: string): PlanoParams {
  const s = (instrucao || "").toLowerCase();
  if (/din[aâ]mic|r[aá]pid|agressiv|corta tudo/.test(s)) return { silencioMinSegundos: 0.5 };
  if (/suave|leve|pouco corte|conservador/.test(s)) return { silencioMinSegundos: 1.5 };
  return { silencioMinSegundos: 0.8 };
}

/**
 * Gera o plano base: mantém trechos falados e corta os silêncios (gaps entre
 * palavras >= silencioMinSegundos). Legendas vêm do agrupamento das palavras.
 * Determinístico — a revisão manual (timeline) ajusta depois.
 */
export function gerarPlanoBase(words: WhisperWord[], params: PlanoParams): EditPlan {
  if (words.length === 0) return { segments: [], captions: [] };

  const segments: EditSegment[] = [];
  let runStart = words[0].start;
  let prevEnd = words[0].end;

  for (let i = 1; i < words.length; i++) {
    const w = words[i];
    const gap = w.start - prevEnd;
    if (gap >= params.silencioMinSegundos) {
      segments.push({ start: runStart, end: prevEnd, keep: true });
      segments.push({ start: prevEnd, end: w.start, keep: false });
      runStart = w.start;
    }
    prevEnd = w.end;
  }
  segments.push({ start: runStart, end: prevEnd, keep: true });

  const captions: CaptionLine[] = groupWordsIntoLines(words).map((line) => ({
    start: line.start,
    end: line.end,
    text: line.words.map((x) => x.word).join(" ").replace(/\s+/g, " ").trim(),
  }));

  return { segments, captions };
}
