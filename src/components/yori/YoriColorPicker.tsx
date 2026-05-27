"use client";

import { useState } from "react";
import { HexColorPicker } from "react-colorful";

interface Props {
  value: string;
  onChange: (color: string) => void;
  label: string;
}

export function YoriColorPicker({ value, onChange, label }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-2 rounded-md border bg-card px-2 text-xs hover:bg-muted"
      >
        <div className="h-5 w-5 rounded border" style={{ backgroundColor: value }} />
        <span className="font-mono">{value.toUpperCase()}</span>
      </button>
      {open && (
        <div className="absolute z-30 mt-2 rounded-lg border bg-popover p-3 shadow-lg">
          <HexColorPicker color={value} onChange={onChange} />
          <input
            type="text"
            value={value}
            onChange={(e) => {
              const v = e.target.value;
              if (/^#[0-9A-Fa-f]{6}$/.test(v)) onChange(v);
            }}
            className="mt-2 block w-full rounded border bg-background px-2 py-1 text-xs font-mono"
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-2 w-full rounded bg-primary px-2 py-1 text-xs text-primary-foreground"
          >
            Fechar
          </button>
        </div>
      )}
    </div>
  );
}
