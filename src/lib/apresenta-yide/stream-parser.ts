import { isValidSlide, type Slide } from "./tipos";

/**
 * Acumula chunks de texto do stream do Claude e emite slides à medida
 * que linhas completas chegam. Cada linha esperada é um JSON object
 * válido representando um Slide. Linhas inválidas (mal formatadas ou
 * que falham validação de shape) são silenciosamente descartadas —
 * tipicamente isso indica chunk parcial ou ruído do modelo.
 */
export class LineDelimitedSlideParser {
  private buffer = "";

  /** Alimenta um chunk de texto. Retorna slides completos extraídos. */
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

  /** Drena o buffer final (linha sem \n no fim). Use após o stream terminar. */
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
