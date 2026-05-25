// src/lib/trafego/relatorios/stream-parser.ts
//
// Mesmo padrão do apresenta-yide/stream-parser.ts, mas valida com o
// isValidSlide DESTE módulo (que reconhece grafico_barras).
import { isValidSlide, type Slide } from "./tipos";

export class LineDelimitedSlideParser {
  private buffer = "";

  feed(chunk: string): Slide[] {
    this.buffer += chunk;
    const slides: Slide[] = [];
    let newlineIdx: number;
    while ((newlineIdx = this.buffer.indexOf("\n")) !== -1) {
      const line = this.buffer.slice(0, newlineIdx).trim();
      this.buffer = this.buffer.slice(newlineIdx + 1);
      if (line.length === 0) continue;
      const parsed = this.tryParse(line);
      if (parsed) slides.push(parsed);
    }
    return slides;
  }

  flush(): Slide[] {
    const line = this.buffer.trim();
    this.buffer = "";
    if (line.length === 0) return [];
    const parsed = this.tryParse(line);
    return parsed ? [parsed] : [];
  }

  private tryParse(line: string): Slide | null {
    let obj: unknown;
    try {
      obj = JSON.parse(line);
    } catch {
      return null;
    }
    if (!isValidSlide(obj)) return null;
    return obj;
  }
}
