"use client";

import { useState, useTransition } from "react";
import { Save, Plus, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateStyleGuideAction } from "@/lib/design/actions";
import type { StyleGuide } from "@/lib/design/tipos";

interface Props {
  clientId: string;
  initial: StyleGuide;
  canEdit: boolean;
}

export function StyleGuideCard({ clientId, initial, canEdit }: Props) {
  const [paletas, setPaletas] = useState<string[]>(initial.paletas ?? []);
  const [fontesT, setFontesT] = useState<string[]>(initial.fontes_titulos ?? []);
  const [fontesC, setFontesC] = useState<string[]>(initial.fontes_corpo ?? []);
  const [mood, setMood] = useState(initial.mood ?? "");
  const [tomVoz, setTomVoz] = useState(initial.tom_voz ?? "");
  const [referencias, setReferencias] = useState<string[]>(initial.referencias ?? []);
  const [evitar, setEvitar] = useState(initial.evitar ?? "");
  const [marca, setMarca] = useState(initial.marca ?? "");
  const [exemplos, setExemplos] = useState<string[]>(initial.exemplos_aprovados ?? []);
  const [paletaInput, setPaletaInput] = useState("#");
  const [fonteTInput, setFonteTInput] = useState("");
  const [fonteCInput, setFonteCInput] = useState("");
  const [refInput, setRefInput] = useState("");
  const [exemploInput, setExemploInput] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  function addTo(setter: (v: string[]) => void, current: string[], value: string, reset: () => void) {
    const v = value.trim();
    if (!v || current.includes(v)) {
      reset();
      return;
    }
    setter([...current, v]);
    reset();
  }
  function removeFrom(setter: (v: string[]) => void, current: string[], idx: number) {
    setter(current.filter((_, i) => i !== idx));
  }

  function onSave() {
    setError(null);
    const fd = new FormData();
    fd.set("client_id", clientId);
    fd.set("paletas", JSON.stringify(paletas));
    fd.set("fontes_titulos", JSON.stringify(fontesT));
    fd.set("fontes_corpo", JSON.stringify(fontesC));
    fd.set("mood", mood);
    fd.set("tom_voz", tomVoz);
    fd.set("referencias", JSON.stringify(referencias));
    fd.set("evitar", evitar);
    fd.set("marca", marca);
    fd.set("exemplos_aprovados", JSON.stringify(exemplos));
    startTransition(async () => {
      const r = await updateStyleGuideAction(fd);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      setSavedAt(new Date());
    });
  }

  return (
    <Card className="p-5 space-y-5">
      <div className="space-y-1">
        <h2 className="font-semibold text-base">🎨 Style Guide do Cliente</h2>
        <p className="text-[11px] text-muted-foreground">
          Memória de estilo do cliente. Quando a Fase 2 (geração com IA) chegar,
          esses dados vão pro prompt automaticamente.
        </p>
      </div>

      {/* Paletas */}
      <div className="space-y-2">
        <Label>Paleta de cores</Label>
        <div className="flex flex-wrap gap-2">
          {paletas.map((cor, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2 py-1 text-xs"
            >
              <span
                className="inline-block h-3 w-3 rounded-full border"
                style={{ backgroundColor: cor }}
              />
              <code>{cor}</code>
              {canEdit && (
                <button type="button" onClick={() => removeFrom(setPaletas, paletas, i)}>
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
            </span>
          ))}
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Input
              value={paletaInput}
              onChange={(e) => setPaletaInput(e.target.value)}
              placeholder="#0EA5E9"
              maxLength={20}
              className="w-32"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => addTo(setPaletas, paletas, paletaInput, () => setPaletaInput("#"))}
            >
              <Plus className="h-3 w-3" /> Adicionar cor
            </Button>
          </div>
        )}
      </div>

      {/* Fontes */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Fontes para títulos</Label>
          <div className="flex flex-wrap gap-1.5">
            {fontesT.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-md border bg-card px-2 py-0.5 text-xs">
                {f}
                {canEdit && (
                  <button type="button" onClick={() => removeFrom(setFontesT, fontesT, i)}>
                    <X className="h-3 w-3 text-muted-foreground" />
                  </button>
                )}
              </span>
            ))}
          </div>
          {canEdit && (
            <div className="flex gap-1.5">
              <Input
                value={fonteTInput}
                onChange={(e) => setFonteTInput(e.target.value)}
                placeholder="Poppins"
                maxLength={80}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => addTo(setFontesT, fontesT, fonteTInput, () => setFonteTInput(""))}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label>Fontes para corpo</Label>
          <div className="flex flex-wrap gap-1.5">
            {fontesC.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-md border bg-card px-2 py-0.5 text-xs">
                {f}
                {canEdit && (
                  <button type="button" onClick={() => removeFrom(setFontesC, fontesC, i)}>
                    <X className="h-3 w-3 text-muted-foreground" />
                  </button>
                )}
              </span>
            ))}
          </div>
          {canEdit && (
            <div className="flex gap-1.5">
              <Input
                value={fonteCInput}
                onChange={(e) => setFonteCInput(e.target.value)}
                placeholder="Inter"
                maxLength={80}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => addTo(setFontesC, fontesC, fonteCInput, () => setFonteCInput(""))}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Mood + Tom voz */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="mood">Mood / Visual</Label>
          <Textarea
            id="mood"
            rows={3}
            value={mood}
            onChange={(e) => setMood(e.target.value)}
            placeholder="Ex.: Minimalista, alto contraste, cores frias, geometria simples"
            disabled={!canEdit}
            maxLength={1000}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tom_voz">Tom de voz</Label>
          <Textarea
            id="tom_voz"
            rows={3}
            value={tomVoz}
            onChange={(e) => setTomVoz(e.target.value)}
            placeholder="Ex.: Direto, profissional, sem emojis. Foco em resultado."
            disabled={!canEdit}
            maxLength={1000}
          />
        </div>
      </div>

      {/* Marca */}
      <div className="space-y-1.5">
        <Label htmlFor="marca">Marca / Logo</Label>
        <Textarea
          id="marca"
          rows={2}
          value={marca}
          onChange={(e) => setMarca(e.target.value)}
          placeholder="Ex.: Logo branco em fundo escuro, sempre canto inferior direito, tamanho 80px"
          disabled={!canEdit}
          maxLength={1000}
        />
      </div>

      {/* Evitar */}
      <div className="space-y-1.5">
        <Label htmlFor="evitar">O que evitar</Label>
        <Textarea
          id="evitar"
          rows={2}
          value={evitar}
          onChange={(e) => setEvitar(e.target.value)}
          placeholder="Ex.: Não usar tons de marrom, não fazer carrossel com mais de 8 slides, evitar fotos de banco de imagem"
          disabled={!canEdit}
          maxLength={2000}
        />
      </div>

      {/* Referências */}
      <div className="space-y-2">
        <Label>Referências (URLs de inspiração)</Label>
        <div className="space-y-1">
          {referencias.map((url, i) => (
            <div key={i} className="flex items-center gap-2 rounded-md border bg-card px-2 py-1">
              <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs truncate flex-1 hover:underline">
                {url}
              </a>
              {canEdit && (
                <button type="button" onClick={() => removeFrom(setReferencias, referencias, i)}>
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
            </div>
          ))}
        </div>
        {canEdit && (
          <div className="flex gap-1.5">
            <Input
              value={refInput}
              onChange={(e) => setRefInput(e.target.value)}
              placeholder="https://..."
              type="url"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => addTo(setReferencias, referencias, refInput, () => setRefInput(""))}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Exemplos aprovados */}
      <div className="space-y-2">
        <Label>Exemplos aprovados (artes que o cliente já adorou)</Label>
        <div className="space-y-1">
          {exemplos.map((url, i) => (
            <div key={i} className="flex items-center gap-2 rounded-md border bg-emerald-500/5 border-emerald-500/30 px-2 py-1">
              <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs truncate flex-1 hover:underline text-emerald-700 dark:text-emerald-300">
                {url}
              </a>
              {canEdit && (
                <button type="button" onClick={() => removeFrom(setExemplos, exemplos, i)}>
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
            </div>
          ))}
        </div>
        {canEdit && (
          <div className="flex gap-1.5">
            <Input
              value={exemploInput}
              onChange={(e) => setExemploInput(e.target.value)}
              placeholder="https://..."
              type="url"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => addTo(setExemplos, exemplos, exemploInput, () => setExemploInput(""))}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {canEdit && (
        <div className="flex items-center gap-2 border-t pt-4">
          <Button type="button" onClick={onSave} disabled={pending}>
            <Save className="h-4 w-4" /> {pending ? "Salvando..." : "Salvar style guide"}
          </Button>
          {savedAt && !pending && (
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
              ✓ Salvo {savedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      )}
    </Card>
  );
}
