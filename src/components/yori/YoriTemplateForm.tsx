"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createYoriTemplateAction, updateYoriTemplateAction } from "@/lib/yori/actions";
import type { YoriTemplate, BaseTemplate, FontFamily, Position, Animation } from "@/lib/yori/tipos";
import { BASE_TEMPLATES, POSITIONS, ANIMATIONS } from "@/lib/yori/tipos";
import { YoriColorPicker } from "./YoriColorPicker";
import { YoriFontPicker } from "./YoriFontPicker";

interface Props {
  initial?: YoriTemplate;
  onClose: () => void;
}

export function YoriTemplateForm({ initial, onClose }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [nome, setNome] = useState(initial?.nome ?? "");
  const [baseTemplate, setBaseTemplate] = useState<BaseTemplate>(initial?.base_template ?? "submagic");
  const [primaryColor, setPrimaryColor] = useState(initial?.primary_color ?? "#FFFFFF");
  const [highlightColor, setHighlightColor] = useState(initial?.highlight_color ?? "#FFD600");
  const [fontFamily, setFontFamily] = useState<FontFamily>(initial?.font_family ?? "inter");
  const [fontSize, setFontSize] = useState(initial?.font_size ?? 56);
  const [position, setPosition] = useState<Position>(initial?.position ?? "center");
  const [hasShadow, setHasShadow] = useState(initial?.has_shadow ?? true);
  const [shadowIntensity, setShadowIntensity] = useState(initial?.shadow_intensity ?? 50);
  const [animation, setAnimation] = useState<Animation>(initial?.animation ?? "pop");
  const [positionYOffset, setPositionYOffset] = useState(initial?.position_y_offset ?? 0);

  function handleSubmit() {
    setError(null);
    const fd = new FormData();
    if (initial) fd.set("id", initial.id);
    fd.set("nome", nome);
    fd.set("base_template", baseTemplate);
    fd.set("primary_color", primaryColor);
    if (baseTemplate === "submagic") fd.set("highlight_color", highlightColor);
    fd.set("font_family", fontFamily);
    fd.set("font_size", String(fontSize));
    fd.set("position", position);
    fd.set("position_y_offset", String(positionYOffset));
    fd.set("has_shadow", hasShadow ? "true" : "false");
    fd.set("shadow_intensity", String(shadowIntensity));
    fd.set("animation", animation);

    startTransition(async () => {
      const r = initial ? await updateYoriTemplateAction(fd) : await createYoriTemplateAction(fd);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium mb-1">Nome</label>
        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          maxLength={60}
          className="block w-full rounded-md border bg-background px-2 py-1.5 text-xs"
          placeholder="ex: Estilo Cliente X"
        />
      </div>

      <div>
        <label className="block text-xs font-medium mb-1">Estilo base</label>
        <div className="grid grid-cols-3 gap-1.5">
          {BASE_TEMPLATES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setBaseTemplate(t)}
              className={`rounded-md border px-2 py-1.5 text-xs ${
                baseTemplate === t ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:bg-muted"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <YoriColorPicker value={primaryColor} onChange={setPrimaryColor} label="Cor principal" />
        {baseTemplate === "submagic" && (
          <YoriColorPicker value={highlightColor} onChange={setHighlightColor} label="Cor destaque" />
        )}
      </div>

      <YoriFontPicker value={fontFamily} onChange={setFontFamily} />

      <div>
        <label className="block text-xs font-medium mb-1">Tamanho ({fontSize}px)</label>
        <input
          type="range"
          min={24}
          max={80}
          value={fontSize}
          onChange={(e) => setFontSize(Number(e.target.value))}
          className="w-full"
        />
      </div>

      <div>
        <label className="block text-xs font-medium mb-1">Posição</label>
        <div className="grid grid-cols-3 gap-1.5">
          {POSITIONS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPosition(p)}
              className={`rounded-md border px-2 py-1.5 text-xs ${
                position === p ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:bg-muted"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="flex items-center gap-2 text-xs font-medium">
          <input type="checkbox" checked={hasShadow} onChange={(e) => setHasShadow(e.target.checked)} />
          Sombra ({shadowIntensity}%)
        </label>
        {hasShadow && (
          <input
            type="range"
            min={0}
            max={100}
            value={shadowIntensity}
            onChange={(e) => setShadowIntensity(Number(e.target.value))}
            className="w-full mt-1"
          />
        )}
      </div>

      <div>
        <label className="block text-xs font-medium mb-1">Animação</label>
        <div className="grid grid-cols-4 gap-1.5">
          {ANIMATIONS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAnimation(a)}
              className={`rounded-md border px-2 py-1.5 text-xs ${
                animation === a ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:bg-muted"
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1">Ajuste vertical ({positionYOffset}px)</label>
        <input
          type="range"
          min={-200}
          max={200}
          value={positionYOffset}
          onChange={(e) => setPositionYOffset(Number(e.target.value))}
          className="w-full"
        />
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending || !nome}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {initial ? "Atualizar" : "Criar"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 items-center rounded-md border bg-card px-3 text-xs font-medium hover:bg-muted"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
