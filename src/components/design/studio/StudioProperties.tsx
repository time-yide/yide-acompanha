// src/components/design/studio/StudioProperties.tsx
"use client";

import { ArrowUp, ArrowDown, Trash2 } from "lucide-react";
import type { Camada } from "@/lib/design/studio-tipos";
import type { Acao } from "./useComposicao";

interface Props {
  camada: Camada | null;
  dispatch: (a: Acao) => void;
  onDeselect: () => void;
}

const label = "text-[10px] uppercase tracking-wide text-muted-foreground";
const inputCls =
  "w-full rounded-md border bg-card px-2 py-1 text-xs outline-none focus:border-primary";

export function StudioProperties({ camada, dispatch, onDeselect }: Props) {
  if (!camada) {
    return (
      <div className="p-3">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Propriedades
        </div>
        <p className="text-xs text-muted-foreground">Selecione um elemento na tela</p>
      </div>
    );
  }

  function patch(p: Partial<Camada>) {
    dispatch({ type: "updateCamada", id: camada!.id, patch: p });
  }

  return (
    <div className="space-y-3 p-3">
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        Propriedades
      </div>

      {camada.tipo === "texto" && (
        <div className="space-y-2">
          <div className={label}>Texto</div>
          <textarea
            className={`${inputCls} min-h-[50px] resize-none`}
            value={camada.text}
            onChange={(e) => patch({ text: e.target.value })}
          />
          <Field l="Cor">
            <input
              type="color"
              className="h-7 w-9 rounded border bg-transparent p-0.5"
              value={camada.color}
              onChange={(e) => patch({ color: e.target.value })}
            />
          </Field>
          <Field l="Tamanho">
            <input
              type="number"
              min={6}
              max={400}
              className={inputCls}
              value={camada.fontSize}
              onChange={(e) => patch({ fontSize: Number(e.target.value) || 24 })}
            />
          </Field>
          <Field l="Peso">
            <select
              className={inputCls}
              value={camada.fontWeight}
              onChange={(e) => patch({ fontWeight: Number(e.target.value) })}
            >
              <option value={300}>Light</option>
              <option value={400}>Regular</option>
              <option value={600}>Semi-bold</option>
              <option value={700}>Bold</option>
              <option value={900}>Black</option>
            </select>
          </Field>
          <div className={label}>Alinhamento</div>
          <div className="flex gap-1">
            {(["left", "center", "right"] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => patch({ align: a })}
                className={`flex-1 rounded border px-2 py-1 text-xs ${
                  camada.align === a ? "border-primary bg-primary/10" : "bg-card hover:border-primary"
                }`}
              >
                {a === "left" ? "Esq" : a === "center" ? "Centro" : "Dir"}
              </button>
            ))}
          </div>
          <Field l="Espaç.">
            <input
              type="range"
              min={0}
              max={40}
              className="flex-1 accent-primary"
              value={camada.spacing}
              onChange={(e) => patch({ spacing: Number(e.target.value) })}
            />
          </Field>
        </div>
      )}

      {camada.tipo === "shape" && (
        <div className="space-y-2">
          <div className={label}>Forma</div>
          <Field l="Cor fundo">
            <input
              type="color"
              className="h-7 w-9 rounded border bg-transparent p-0.5"
              value={hex(camada.bg)}
              onChange={(e) => patch({ bg: e.target.value })}
            />
          </Field>
          <Field l="Borda cor">
            <input
              type="color"
              className="h-7 w-9 rounded border bg-transparent p-0.5"
              value={hex(camada.borderColor)}
              onChange={(e) => patch({ borderColor: e.target.value })}
            />
          </Field>
          <Field l="Borda px">
            <input
              type="number"
              min={0}
              max={40}
              className={inputCls}
              value={camada.borderW}
              onChange={(e) => patch({ borderW: Number(e.target.value) || 0 })}
            />
          </Field>
          <Field l="Radius">
            <input
              type="number"
              min={0}
              max={1000}
              className={inputCls}
              value={camada.radius}
              onChange={(e) => patch({ radius: Number(e.target.value) || 0 })}
            />
          </Field>
        </div>
      )}

      <div className="space-y-1">
        <div className={label}>Opacidade ({Math.round(camada.opacity * 100)}%)</div>
        <input
          type="range"
          min={5}
          max={100}
          className="w-full accent-primary"
          value={Math.round(camada.opacity * 100)}
          onChange={(e) => patch({ opacity: Number(e.target.value) / 100 })}
        />
      </div>

      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => dispatch({ type: "reordenar", id: camada.id, dir: "up" })}
          className="flex flex-1 items-center justify-center rounded border bg-card py-1.5 hover:border-primary"
          title="Subir camada"
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: "reordenar", id: camada.id, dir: "down" })}
          className="flex flex-1 items-center justify-center rounded border bg-card py-1.5 hover:border-primary"
          title="Descer camada"
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => {
            dispatch({ type: "removeCamada", id: camada.id });
            onDeselect();
          }}
          className="flex flex-1 items-center justify-center rounded border border-destructive/40 py-1.5 text-destructive hover:border-destructive"
          title="Deletar"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function Field({ l, children }: { l: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-[10px] text-muted-foreground">{l}</span>
      {children}
    </div>
  );
}

/** Normaliza pra um valor aceito pelo <input type=color>. */
function hex(c: string): string {
  if (c && c.startsWith("#") && (c.length === 7 || c.length === 4)) return c;
  return "#000000";
}
