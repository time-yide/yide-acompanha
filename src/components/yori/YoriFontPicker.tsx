"use client";

import type { FontFamily } from "@/lib/yori/tipos";

const FONT_LABELS: Record<FontFamily, string> = {
  inter: "Inter",
  montserrat: "Montserrat",
  bebas: "Bebas Neue",
  oswald: "Oswald",
  poppins: "Poppins",
  roboto: "Roboto",
  anton: "Anton",
  archivo_black: "Archivo Black",
};

const FONT_PREVIEW_STYLE: Record<FontFamily, string> = {
  inter: "font-sans",
  montserrat: "font-sans",
  bebas: "tracking-wide uppercase",
  oswald: "tracking-wide",
  poppins: "font-sans",
  roboto: "font-sans",
  anton: "tracking-wide uppercase",
  archivo_black: "font-black",
};

interface Props {
  value: FontFamily;
  onChange: (font: FontFamily) => void;
}

export function YoriFontPicker({ value, onChange }: Props) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">Fonte</label>
      <div className="grid grid-cols-2 gap-1.5">
        {(Object.keys(FONT_LABELS) as FontFamily[]).map((font) => (
          <button
            key={font}
            type="button"
            onClick={() => onChange(font)}
            className={`rounded-md border px-2 py-1.5 text-xs ${FONT_PREVIEW_STYLE[font]} ${
              value === font
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card hover:bg-muted"
            }`}
          >
            {FONT_LABELS[font]}
          </button>
        ))}
      </div>
    </div>
  );
}
