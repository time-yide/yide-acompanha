import type { WhisperWord } from "./tipos";

const PAUSE_THRESHOLD_S = 1.0;

export interface SubtitleLine {
  start: number;
  end: number;
  words: WhisperWord[];
}

export function groupWordsIntoLines(
  words: WhisperWord[],
  maxWords: number = 7,
): SubtitleLine[] {
  if (words.length === 0) return [];

  const lines: SubtitleLine[] = [];
  let current: WhisperWord[] = [];

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const prev = words[i - 1];

    const shouldBreak =
      current.length >= maxWords
      || (prev && w.start - prev.end > PAUSE_THRESHOLD_S);

    if (shouldBreak && current.length > 0) {
      lines.push({
        start: current[0].start,
        end: current[current.length - 1].end,
        words: current,
      });
      current = [];
    }
    current.push(w);
  }

  if (current.length > 0) {
    lines.push({
      start: current[0].start,
      end: current[current.length - 1].end,
      words: current,
    });
  }

  return lines;
}

function formatSrtTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

export function buildSrt(words: WhisperWord[]): string {
  const lines = groupWordsIntoLines(words);
  return lines
    .map((line, i) => {
      const text = line.words.map((w) => w.word).join(" ");
      return `${i + 1}\n${formatSrtTimestamp(line.start)} --> ${formatSrtTimestamp(line.end)}\n${text}`;
    })
    .join("\n\n");
}

export function buildTxt(words: WhisperWord[]): string {
  return words.map((w) => w.word).join(" ").trim();
}
