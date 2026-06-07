// src/components/design/studio/StudioShell.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, Palette } from "lucide-react";
import { FORMATOS } from "@/lib/design/tipos";
import {
  COMPOSICAO_VAZIA,
  dimensoesDoFormato,
  type Composicao,
  type FonteMarca,
  type ManualMarca,
} from "@/lib/design/studio-tipos";
import { salvarComposicaoAction } from "@/lib/design/studio-actions";
import { useComposicao } from "./useComposicao";
import { exportarCanvasPng } from "./exportCanvas";
import { StudioCanvas } from "./StudioCanvas";
import { StudioLeftPanel } from "./StudioLeftPanel";
import { StudioProperties } from "./StudioProperties";
import { StudioChat } from "./StudioChat";

const FONTES_WEB = [
  "Inter",
  "Arial",
  "Georgia",
  "Times New Roman",
  "Courier New",
  "Verdana",
  "Impact",
];

interface Props {
  clientId: string;
  nomeCliente: string;
  manualInicial: ManualMarca;
  arteInicial?: { id: string; titulo: string; composicao: Composicao };
}

/** Injeta uma regra @font-face no <head> (idempotente por nome). */
function injetarFonte(f: FonteMarca) {
  if (typeof document === "undefined") return;
  const id = `studio-font-${f.nome.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `@font-face{font-family:"${f.nome}";src:url("${f.url}") format("${f.format}");font-display:swap;}`;
  document.head.appendChild(style);
}

export function StudioShell({ clientId, nomeCliente, manualInicial, arteInicial }: Props) {
  const router = useRouter();

  // Manual da marca em estado local: logo/fundo_padrao podem ser atualizados
  // ao vivo a partir do painel esquerdo.
  const [manual, setManual] = useState<ManualMarca>(manualInicial);

  // Composição inicial: arte existente ou nova com defaults da marca.
  const inicial = useMemo<Composicao>(() => {
    if (arteInicial) return arteInicial.composicao;
    return {
      ...COMPOSICAO_VAZIA,
      fundo: { ...COMPOSICAO_VAZIA.fundo, cor: manual.fundo_padrao ?? COMPOSICAO_VAZIA.fundo.cor },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { composicao, dispatch, aplicarIA } = useComposicao(inicial);
  const [selId, setSelId] = useState<string | null>(null);
  const [aba, setAba] = useState<"editor" | "chat">("editor");
  const [titulo, setTitulo] = useState(arteInicial?.titulo ?? "");
  const [arteId, setArteId] = useState<string | null>(arteInicial?.id ?? null);
  const [fontesExtra, setFontesExtra] = useState<FonteMarca[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, startSalvar] = useTransition();
  const [iaInfo, setIaInfo] = useState<{ modelo: string; prompt: string; url: string } | null>(null);
  const [gerando, setGerando] = useState(false);

  const canvasRef = useRef<HTMLDivElement | null>(null);

  // Injeta as fontes da marca ao abrir.
  useEffect(() => {
    manual.fontes.forEach(injetarFonte);
  }, [manual.fontes]);

  function onFonteCarregada(f: FonteMarca) {
    injetarFonte(f);
    setFontesExtra((prev) => (prev.some((x) => x.nome === f.nome) ? prev : [...prev, f]));
  }

  function onLogoAtualizada(url: string) {
    setManual((m) => ({ ...m, logo_url: url }));
  }

  function onFundoPadraoAtualizado(cor: string) {
    setManual((m) => ({ ...m, fundo_padrao: cor }));
  }

  const dims = dimensoesDoFormato(composicao.formato);

  // Escala de exibição: caber numa janela de ~520px de largura / ~620px de altura.
  const escala = useMemo(() => {
    const maxW = 520;
    const maxH = 620;
    return Math.min(maxW / dims.w, maxH / dims.h, 1);
  }, [dims.w, dims.h]);

  const camadaSel = selId ? composicao.camadas.find((c) => c.id === selId) ?? null : null;

  // Geração de imagem por IA (on-demand). Retorna a URL ou null em caso de falha.
  const gerarImagem = useCallback(
    async (prompt: string, alvo: "fundo" | "camada"): Promise<string | null> => {
      setGerando(true);
      try {
        const resp = await fetch("/api/design/studio/gerar-imagem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId, prompt, formato: composicao.formato }),
        });
        const data = await resp.json();
        if (!resp.ok || !data.url) return null;
        if (alvo === "camada") {
          dispatch({ type: "addCamada", camada: { tipo: "imagem", src: data.url, x: 100, y: 100, w: 400, h: 400, opacity: 1 } });
        } else {
          dispatch({ type: "setFoto", foto: { url: data.url, zoom: 100, x: 0, y: 0, opacidade: 100 } });
        }
        setIaInfo({ modelo: "gpt-image-1", prompt, url: data.url });
        return data.url as string;
      } catch (e) {
        console.error("[gerarImagem]", e);
        return null;
      } finally {
        setGerando(false);
      }
    },
    [clientId, composicao.formato, dispatch],
  );

  async function salvar() {
    setErro(null);
    if (!titulo.trim()) {
      setErro("Dê um título à arte antes de salvar.");
      return;
    }
    if (!canvasRef.current) {
      setErro("Canvas não pronta.");
      return;
    }
    setSelId(null);
    setAba("editor");
    startSalvar(async () => {
      if (!canvasRef.current) { setErro("Canvas não pronta."); return; }
      try {
        const pngBase64 = await exportarCanvasPng(canvasRef.current, dims);
        const iaUrl = iaInfo?.url;
        const iaAindaPresente = !!iaUrl && (
          composicao.fundo.foto?.url === iaUrl ||
          composicao.camadas.some((c) => "src" in c && (c as { src?: string }).src === iaUrl)
        );
        const r = await salvarComposicaoAction({
          clientId,
          arteId,
          titulo: titulo.trim(),
          formato: composicao.formato,
          composicao,
          pngBase64,
          iaInfo: iaInfo && iaAindaPresente ? { modelo: iaInfo.modelo, prompt: iaInfo.prompt } : undefined,
        });
        if ("error" in r) {
          setErro(r.error);
          if (r.arteId) setArteId(r.arteId);
          return;
        }
        setArteId(r.arteId);
        router.push(`/design/${clientId}`);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Falha ao exportar a arte.");
      }
    });
  }

  return (
    <div className="flex h-[calc(100vh-1px)] flex-col">
      {/* HEADER */}
      <header className="flex flex-shrink-0 flex-wrap items-center justify-between gap-2 border-b bg-card px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Palette className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">Studio · {nomeCliente}</div>
            <div className="text-[10px] text-muted-foreground">Editor de arte</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Título da arte"
            className="w-32 rounded-md border bg-card px-2 py-1.5 text-xs outline-none focus:border-primary sm:w-44"
          />
          <select
            value={composicao.formato}
            onChange={(e) => dispatch({ type: "setFormato", formato: e.target.value })}
            className="rounded-md border bg-card px-2 py-1.5 text-xs outline-none focus:border-primary"
          >
            {FORMATOS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setAba("editor")}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium ${aba === "editor" ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary"}`}
            >
              Editor
            </button>
            <button
              type="button"
              onClick={() => setAba("chat")}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium ${aba === "chat" ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary"}`}
            >
              Chat IA
            </button>
          </div>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {salvando ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </header>

      {erro && (
        <div className="flex-shrink-0 border-b bg-destructive/10 px-4 py-1.5 text-xs text-destructive">
          {erro}
        </div>
      )}

      {/* BODY */}
      <div className="flex min-h-0 flex-1">
        {/* ESQUERDA */}
        <div className="w-64 flex-shrink-0 border-r bg-card">
          <StudioLeftPanel
            clientId={clientId}
            manual={manual}
            composicao={composicao}
            selId={selId}
            dispatch={dispatch}
            onSelect={setSelId}
            fontesExtra={fontesExtra}
            onFonteCarregada={onFonteCarregada}
            onLogoAtualizada={onLogoAtualizada}
            onFundoPadraoAtualizado={onFundoPadraoAtualizado}
            fontesWeb={FONTES_WEB}
          />
        </div>

        {/* CENTRO */}
        <div className="flex min-w-0 flex-1 flex-col bg-muted/40">
          {aba === "editor" ? (
            <div className="flex flex-1 items-center justify-center overflow-auto p-5">
              <StudioCanvas
                composicao={composicao}
                selId={selId}
                onSelect={setSelId}
                dispatch={dispatch}
                canvasRef={canvasRef}
                escala={escala}
              />
            </div>
          ) : (
            <StudioChat
              clientId={clientId}
              composicao={composicao}
              logoUrl={manual.logo_url}
              aplicarIA={aplicarIA}
              onGerarImagem={gerarImagem}
              gerando={gerando}
              onAplicado={() => setAba("editor")}
            />
          )}
        </div>

        {/* DIREITA */}
        <div className="w-56 flex-shrink-0 border-l bg-card">
          <StudioProperties camada={camadaSel} dispatch={dispatch} onDeselect={() => setSelId(null)} />
        </div>
      </div>
    </div>
  );
}
