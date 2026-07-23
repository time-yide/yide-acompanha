import type { TranscriptSegment } from "./tipos";
import type { WhisperWord } from "@/lib/yori/tipos";

/**
 * Agrupa palavras (com timestamps do Whisper) em segmentos de até `maxSeg`
 * segundos, pra timeline. Sem diarização (speaker genérico) — Fatia 2.
 */
export function wordsToSegments(words: WhisperWord[], maxSeg = 12): TranscriptSegment[] {
  const segs: TranscriptSegment[] = [];
  let cur: WhisperWord[] = [];
  let inicio = 0;
  const flush = () => {
    if (cur.length === 0) return;
    segs.push({
      speaker: "Reunião",
      speaker_id: null,
      start: inicio,
      end: cur[cur.length - 1].end,
      text: cur.map((w) => w.word).join(" ").replace(/\s+([,.!?])/g, "$1").trim(),
    });
    cur = [];
  };
  for (const w of words) {
    if (cur.length === 0) inicio = w.start;
    else if (w.end - inicio > maxSeg) flush();
    if (cur.length === 0) inicio = w.start;
    cur.push(w);
  }
  flush();
  return segs;
}
