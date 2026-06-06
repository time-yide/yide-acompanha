// src/lib/design/studio-comandos.ts
import { FORMAT_DIMS } from "./studio-tipos";

export const ACOES_VALIDAS = [
  "setBg", "setFormato", "toggleStripes", "addTexto",
  "addShape", "addLogo", "updateLayer", "removeLayer", "clearAll",
] as const;

export type Acao = (typeof ACOES_VALIDAS)[number];
export type Comando = Record<string, unknown> & { action: Acao };

export interface RespostaIA {
  mensagem: string;
  comandos: Comando[];
}

const num = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;
const str = (v: unknown, fallback: string): string =>
  typeof v === "string" ? v : fallback;

/** Valida 1 comando bruto. Retorna o comando normalizado ou null se inválido. */
function validarComando(raw: unknown): Comando | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  const action = c.action;
  if (typeof action !== "string" || !(ACOES_VALIDAS as readonly string[]).includes(action)) {
    return null;
  }
  const act = action as Acao;
  switch (act) {
    case "clearAll":
      return { action: act };
    case "setBg":
      if (typeof c.color !== "string") return null;
      return { action: act, color: c.color };
    case "setFormato":
      if (typeof c.formato !== "string" || !(c.formato in FORMAT_DIMS)) return null;
      return { action: act, formato: c.formato };
    case "toggleStripes":
      return { action: act, show: c.show !== false };
    case "addTexto":
      if (typeof c.text !== "string" || c.text.trim() === "") return null;
      return {
        action: act, text: c.text,
        x: num(c.x, 80), y: num(c.y, 200), w: num(c.w, 250),
        fontSize: num(c.fontSize, 40), fontWeight: num(c.fontWeight, 700),
        color: str(c.color, "#ffffff"), align: str(c.align, "center"),
        font: str(c.font, ""), spacing: num(c.spacing, 0),
      };
    case "addShape": {
      const subtype = str(c.subtype, "rect");
      if (!["rect", "circle", "line"].includes(subtype)) return null;
      return {
        action: act, subtype,
        x: num(c.x, 80), y: num(c.y, 180), w: num(c.w, 220), h: num(c.h, 60),
        bg: str(c.bg, "#009c3b"), borderColor: str(c.borderColor, "transparent"),
        borderW: num(c.borderW, 0), radius: num(c.radius, 0),
      };
    }
    case "addLogo":
      return { action: act, x: num(c.x, 880), y: num(c.y, 940), w: num(c.w, 140), h: num(c.h, 100) };
    case "updateLayer":
      if (typeof c.id !== "string") return null;
      return { action: act, id: c.id, props: (c.props && typeof c.props === "object") ? c.props : {} };
    case "removeLayer":
      if (typeof c.id !== "string") return null;
      return { action: act, id: c.id };
    default:
      return null;
  }
}

export function parseRespostaIA(raw: string): RespostaIA {
  const parts = raw.split("---JSON---");
  const mensagem = (parts[0] ?? "").trim();
  const jsonPart = parts[1]?.trim();
  if (!jsonPart) return { mensagem, comandos: [] };

  const limpo = jsonPart.replace(/```json|```/g, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(limpo);
  } catch {
    return { mensagem, comandos: [] };
  }
  const lista = (parsed as { commands?: unknown })?.commands;
  if (!Array.isArray(lista)) return { mensagem, comandos: [] };

  const comandos = lista
    .map(validarComando)
    .filter((c): c is Comando => c !== null);
  return { mensagem, comandos };
}
