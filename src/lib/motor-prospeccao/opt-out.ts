import { OPT_OUT_KEYWORDS } from "./conversa-ia-types";

export function isOptOut(texto: string): boolean {
  const normalized = texto.toLowerCase().trim();
  return OPT_OUT_KEYWORDS.some((kw) => normalized.includes(kw));
}

export function isMediaOnly(params: Record<string, string>): boolean {
  const numMedia = parseInt(params.NumMedia ?? "0", 10);
  const body = (params.Body ?? "").trim();
  return numMedia > 0 && body.length === 0;
}
