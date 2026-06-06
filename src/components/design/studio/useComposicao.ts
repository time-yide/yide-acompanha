// src/components/design/studio/useComposicao.ts
"use client";

import { useReducer, useCallback } from "react";
import type { Camada, CamadaTexto, CamadaShape, CamadaImagem, CamadaLogo, Composicao } from "@/lib/design/studio-tipos";
import { COMPOSICAO_VAZIA } from "@/lib/design/studio-tipos";
import type { Comando } from "@/lib/design/studio-comandos";

function uid(): string {
  return "e" + Math.random().toString(36).slice(2, 10);
}

export type NovaCamada = Omit<CamadaTexto, "id" | "z"> | Omit<CamadaShape, "id" | "z"> | Omit<CamadaImagem, "id" | "z"> | Omit<CamadaLogo, "id" | "z">;

// Fix #4: a IA só pode patchar campos apresentacionais via updateLayer.
// Nunca tipo, id, z ou src (trocar src/tipo abre brecha de conteúdo arbitrário).
const PATCHABLE = new Set([
  "text", "x", "y", "w", "h", "fontSize", "fontWeight", "color", "align",
  "font", "spacing", "bg", "borderColor", "borderW", "radius", "opacity",
]);

export type Acao =
  | { type: "reset"; composicao: Composicao }
  | { type: "addCamada"; camada: NovaCamada }
  | { type: "updateCamada"; id: string; patch: Partial<Camada> }
  | { type: "removeCamada"; id: string }
  | { type: "reordenar"; id: string; dir: "up" | "down" }
  | { type: "setBg"; cor: string }
  | { type: "setFormato"; formato: string }
  | { type: "setFoto"; foto: Composicao["fundo"]["foto"] }
  | { type: "toggleListras"; show: boolean }
  | { type: "limpar" };

export function composicaoReducer(state: Composicao, acao: Acao): Composicao {
  switch (acao.type) {
    case "reset":
      return acao.composicao;
    case "addCamada": {
      const maxZ = state.camadas.reduce((m, c) => Math.max(m, c.z), 10);
      const camada = { ...acao.camada, id: uid(), z: maxZ + 1 } as unknown as Camada;
      return { ...state, camadas: [...state.camadas, camada] };
    }
    case "updateCamada":
      return {
        ...state,
        camadas: state.camadas.map((c) => (c.id === acao.id ? ({ ...c, ...acao.patch } as Camada) : c)),
      };
    case "removeCamada":
      return { ...state, camadas: state.camadas.filter((c) => c.id !== acao.id) };
    case "reordenar":
      return {
        ...state,
        camadas: state.camadas.map((c) =>
          c.id === acao.id ? { ...c, z: acao.dir === "up" ? c.z + 2 : Math.max(1, c.z - 2) } : c,
        ),
      };
    case "setBg":
      return { ...state, fundo: { ...state.fundo, cor: acao.cor } };
    case "setFormato":
      return { ...state, formato: acao.formato };
    case "setFoto":
      return { ...state, fundo: { ...state.fundo, foto: acao.foto } };
    case "toggleListras":
      return { ...state, fundo: { ...state.fundo, listras: acao.show } };
    case "limpar":
      return { ...state, camadas: [] };
    default:
      return state;
  }
}

/** Pure: aplica uma lista de comandos da IA sobre uma composição. */
export function aplicarComandos(state: Composicao, comandos: Comando[], logoUrl: string | null): Composicao {
  let s = state;
  for (const cmd of comandos) {
    switch (cmd.action) {
      case "clearAll":
        s = composicaoReducer(s, { type: "limpar" });
        break;
      case "setBg":
        s = composicaoReducer(s, { type: "setBg", cor: String(cmd.color) });
        break;
      case "setFormato":
        s = composicaoReducer(s, { type: "setFormato", formato: String(cmd.formato) });
        break;
      case "toggleStripes":
        s = composicaoReducer(s, { type: "toggleListras", show: cmd.show !== false });
        break;
      case "addTexto": {
        const { action: _action, ...rest } = cmd;
        s = composicaoReducer(s, { type: "addCamada", camada: { tipo: "texto", opacity: 1, ...(rest as object) } as unknown as NovaCamada });
        break;
      }
      case "addShape": {
        const { action: _action, ...rest } = cmd;
        s = composicaoReducer(s, { type: "addCamada", camada: { tipo: "shape", opacity: 1, ...(rest as object) } as unknown as NovaCamada });
        break;
      }
      case "addLogo": {
        if (!logoUrl) break;
        const { action: _action, ...rest } = cmd;
        s = composicaoReducer(s, { type: "addCamada", camada: { tipo: "logo", src: logoUrl, opacity: 1, ...(rest as object) } as unknown as NovaCamada });
        break;
      }
      case "updateLayer": {
        const props = (cmd.props ?? {}) as Record<string, unknown>;
        const patch: Record<string, unknown> = {};
        for (const k of Object.keys(props)) {
          if (PATCHABLE.has(k)) patch[k] = props[k];
        }
        s = composicaoReducer(s, { type: "updateCamada", id: String(cmd.id), patch: patch as Partial<Camada> });
        break;
      }
      case "removeLayer":
        s = composicaoReducer(s, { type: "removeCamada", id: String(cmd.id) });
        break;
    }
  }
  return s;
}

export function useComposicao(inicial: Composicao = COMPOSICAO_VAZIA) {
  const [composicao, dispatch] = useReducer(composicaoReducer, inicial);
  const aplicarIA = useCallback(
    (comandos: Comando[], logoUrl: string | null) =>
      dispatch({ type: "reset", composicao: aplicarComandos(composicao, comandos, logoUrl) }),
    [composicao],
  );
  return { composicao, dispatch, aplicarIA };
}
