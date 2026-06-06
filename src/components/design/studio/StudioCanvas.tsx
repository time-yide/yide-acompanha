// src/components/design/studio/StudioCanvas.tsx
"use client";

import { useEffect, useRef } from "react";
import type { Camada, Composicao } from "@/lib/design/studio-tipos";
import { dimensoesDoFormato } from "@/lib/design/studio-tipos";
import type { Acao } from "./useComposicao";

interface StudioCanvasProps {
  composicao: Composicao;
  selId: string | null;
  onSelect: (id: string | null) => void;
  dispatch: (a: Acao) => void;
  /** Aponta para o wrapper de tamanho REAL (sem o scale) — usado pelo export. */
  canvasRef: React.RefObject<HTMLDivElement | null>;
  /** Escala de exibição (ex.: 0.4) — aplicada via transform no elemento externo. */
  escala: number;
}

type DragState =
  | { kind: "move"; id: string; sx: number; sy: number; ox: number; oy: number }
  | { kind: "resize"; id: string; sx: number; sy: number; ow: number; oh: number; tipo: Camada["tipo"] };

export function StudioCanvas({ composicao, selId, onSelect, dispatch, canvasRef, escala }: StudioCanvasProps) {
  const dims = dimensoesDoFormato(composicao.formato);
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const d = dragRef.current;
      if (!d) return;
      const dx = (e.clientX - d.sx) / escala;
      const dy = (e.clientY - d.sy) / escala;
      if (d.kind === "move") {
        dispatch({ type: "updateCamada", id: d.id, patch: { x: Math.round(d.ox + dx), y: Math.round(d.oy + dy) } });
      } else {
        const w = Math.max(20, Math.round(d.ow + dx));
        const patch: Partial<Camada> =
          d.tipo === "texto" ? { w } : { w, h: Math.max(4, Math.round(d.oh + dy)) };
        dispatch({ type: "updateCamada", id: d.id, patch });
      }
    }
    function onUp() {
      dragRef.current = null;
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dispatch, escala]);

  function startMove(e: React.MouseEvent, c: Camada) {
    e.stopPropagation();
    onSelect(c.id);
    dragRef.current = { kind: "move", id: c.id, sx: e.clientX, sy: e.clientY, ox: c.x, oy: c.y };
  }

  function startResize(e: React.MouseEvent, c: Camada) {
    e.stopPropagation();
    onSelect(c.id);
    const wAny = c as Camada & { w: number; h?: number };
    dragRef.current = {
      kind: "resize",
      id: c.id,
      sx: e.clientX,
      sy: e.clientY,
      ow: wAny.w,
      oh: "h" in c ? (c as { h: number }).h : wAny.w,
      tipo: c.tipo,
    };
  }

  const foto = composicao.fundo.foto;

  return (
    <div
      className="inline-block origin-top-left shadow-2xl"
      style={{ transform: `scale(${escala})` }}
      onClick={() => onSelect(null)}
    >
      <div
        ref={canvasRef}
        className="relative overflow-hidden"
        style={{ width: dims.w, height: dims.h, background: composicao.fundo.cor }}
      >
        {/* Foto de fundo */}
        {foto && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={foto.url}
              alt=""
              className="absolute h-full w-full"
              style={{
                objectFit: "cover",
                opacity: foto.opacidade,
                transformOrigin: "center center",
                transform: `scale(${foto.zoom}) translate(${foto.x}px, ${foto.y}px)`,
              }}
            />
          </div>
        )}

        {/* Listras topo/base */}
        {composicao.fundo.listras && (
          <>
            <div
              className="pointer-events-none absolute left-0 right-0 top-0"
              style={{ height: 8, zIndex: 5, background: "linear-gradient(90deg,#009c3b,#ffdf00,#009c3b)" }}
            />
            <div
              className="pointer-events-none absolute bottom-0 left-0 right-0"
              style={{ height: 8, zIndex: 5, background: "linear-gradient(90deg,#009c3b,#ffdf00,#009c3b)" }}
            />
          </>
        )}

        {/* Camadas */}
        {composicao.camadas.map((c) => (
          <CamadaView
            key={c.id}
            camada={c}
            selecionada={c.id === selId}
            onMouseDown={(e) => startMove(e, c)}
            onResizeDown={(e) => startResize(e, c)}
          />
        ))}
      </div>
    </div>
  );
}

function CamadaView({
  camada,
  selecionada,
  onMouseDown,
  onResizeDown,
}: {
  camada: Camada;
  selecionada: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onResizeDown: (e: React.MouseEvent) => void;
}) {
  const baseStyle: React.CSSProperties = {
    position: "absolute",
    left: camada.x,
    top: camada.y,
    zIndex: camada.z,
    opacity: camada.opacity,
    cursor: "move",
    userSelect: "none",
    outline: selecionada ? "2px solid #00b850" : undefined,
    outlineOffset: 1,
  };

  const handle = (
    <span
      onMouseDown={onResizeDown}
      style={{
        position: "absolute",
        bottom: -6,
        right: -6,
        width: 14,
        height: 14,
        background: "#00b850",
        borderRadius: 3,
        cursor: "se-resize",
        display: selecionada ? "block" : "none",
        zIndex: 99,
      }}
    />
  );

  if (camada.tipo === "texto") {
    return (
      <div style={{ ...baseStyle, width: camada.w }} onMouseDown={onMouseDown}>
        <div
          style={{
            fontFamily: camada.font || "Inter, sans-serif",
            fontSize: camada.fontSize,
            fontWeight: camada.fontWeight,
            color: camada.color,
            textAlign: camada.align,
            letterSpacing: camada.spacing,
            lineHeight: 1.25,
            padding: 4,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {camada.text}
        </div>
        {handle}
      </div>
    );
  }

  if (camada.tipo === "shape") {
    return (
      <div
        onMouseDown={onMouseDown}
        style={{
          ...baseStyle,
          width: camada.w,
          height: camada.h,
          background: camada.bg,
          borderRadius: camada.radius,
          border: camada.borderW > 0 ? `${camada.borderW}px solid ${camada.borderColor}` : undefined,
        }}
      >
        {handle}
      </div>
    );
  }

  // imagem | logo
  return (
    <div onMouseDown={onMouseDown} style={{ ...baseStyle, width: camada.w, height: camada.h }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={camada.src}
        alt=""
        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", pointerEvents: "none" }}
      />
      {handle}
    </div>
  );
}
