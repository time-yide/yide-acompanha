// Pure (non-server) helpers for the marca (brand manual) module.
// Kept separate from marca-actions.ts so they can be imported by
// both "use server" files and plain client code without triggering
// the Next.js "Server Actions must be async" constraint.

import type { FonteMarca } from "./studio-tipos";

export const MARCA_FONT_EXTS = [".ttf", ".otf", ".woff", ".woff2"] as const;

export function fonteFormatFromName(name: string): FonteMarca["format"] | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".ttf")) return "truetype";
  if (lower.endsWith(".otf")) return "opentype";
  if (lower.endsWith(".woff2")) return "woff2";
  if (lower.endsWith(".woff")) return "woff";
  return null;
}
