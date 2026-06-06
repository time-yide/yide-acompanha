// src/components/design/studio/StudioLeftPanel.tsx
"use client";

import { useRef, useState, useTransition } from "react";
import { Type, Square, Circle, Minus, ImageIcon, Star, Trash2, Upload } from "lucide-react";
import type { Camada, Composicao, FonteMarca, ManualMarca } from "@/lib/design/studio-tipos";
import { uploadFonteMarcaAction } from "@/lib/design/marca-actions";
import { uploadStudioAssetAction } from "@/lib/design/studio-actions";
import type { Acao, NovaCamada } from "./useComposicao";

interface Props {
  clientId: string;
  manual: ManualMarca;
  composicao: Composicao;
  selId: string | null;
  dispatch: (a: Acao) => void;
  onSelect: (id: string | null) => void;
  /** Fontes carregadas em runtime (ainda não persistidas no manual original). */
  fontesExtra: FonteMarca[];
  /** Avisa o Shell que uma nova fonte foi carregada (pra injetar @font-face). */
  onFonteCarregada: (f: FonteMarca) => void;
  /** Fontes web disponíveis no select. */
  fontesWeb: string[];
}

const PRESETS = ["#062e10", "#0a0a0a", "#00205b", "#8b0000", "#ffffff"];
const secTitle = "mb-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground";
const btnElem =
  "flex flex-col items-center gap-1 rounded-md border bg-card px-1 py-2 text-[11px] hover:border-primary hover:text-primary disabled:opacity-40 disabled:hover:border-border disabled:hover:text-current";

export function StudioLeftPanel({
  clientId,
  manual,
  composicao,
  selId,
  dispatch,
  onSelect,
  fontesExtra,
  onFonteCarregada,
  fontesWeb,
}: Props) {
  const fotoInputRef = useRef<HTMLInputElement>(null);
  const fonteInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const [fonteSel, setFonteSel] = useState<string>(manual.fontes[0]?.nome ?? "Inter");
  const [pendingFonte, startFonte] = useTransition();
  const [erroFonte, setErroFonte] = useState<string | null>(null);
  const [pendingFoto, startFoto] = useTransition();
  const [erroFoto, setErroFoto] = useState<string | null>(null);
  const [pendingImg, startImg] = useTransition();
  const [erroImg, setErroImg] = useState<string | null>(null);
  const [papelFonte, setPapelFonte] = useState<"titulo" | "corpo">("titulo");

  const fotoAtual = composicao.fundo.foto;
  const todasFontes: FonteMarca[] = [...manual.fontes, ...fontesExtra];

  function onFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setErroFoto(null);
    startFoto(async () => {
      const fd = new FormData();
      fd.set("file", f);
      const r = await uploadStudioAssetAction(clientId, fd);
      if ("error" in r) {
        setErroFoto(r.error);
        return;
      }
      dispatch({ type: "setFoto", foto: { url: r.url, zoom: 1, x: 0, y: 0, opacidade: 0.55 } });
    });
  }

  function atuFoto(patch: Partial<NonNullable<Composicao["fundo"]["foto"]>>) {
    if (!fotoAtual) return;
    dispatch({ type: "setFoto", foto: { ...fotoAtual, ...patch } });
  }

  function add(camada: NovaCamada) {
    dispatch({ type: "addCamada", camada });
  }

  function addTexto() {
    add({
      tipo: "texto",
      text: "Texto aqui",
      x: 80,
      y: 200,
      w: 600,
      fontSize: 64,
      fontWeight: 700,
      color: "#ffffff",
      align: "center",
      font: fonteSel,
      spacing: 0,
      opacity: 1,
    });
  }

  function addShape(subtype: "rect" | "circle" | "line") {
    add({
      tipo: "shape",
      subtype,
      x: subtype === "line" ? 60 : 200,
      y: subtype === "line" ? 540 : 400,
      w: subtype === "line" ? 960 : subtype === "circle" ? 240 : 480,
      h: subtype === "line" ? 6 : subtype === "circle" ? 240 : 140,
      bg: subtype === "line" ? "#ffdf00" : "#009c3b",
      borderColor: "#ffffff",
      borderW: 0,
      radius: subtype === "circle" ? 9999 : subtype === "line" ? 3 : 16,
      opacity: 1,
    });
  }

  function onImagem(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setErroImg(null);
    startImg(async () => {
      const fd = new FormData();
      fd.set("file", f);
      const r = await uploadStudioAssetAction(clientId, fd);
      if ("error" in r) {
        setErroImg(r.error);
        return;
      }
      add({ tipo: "imagem", src: r.url, x: 200, y: 200, w: 600, h: 450, opacity: 1 });
    });
  }

  function addBadge() {
    add({
      tipo: "shape",
      subtype: "rect",
      x: 200,
      y: 60,
      w: 680,
      h: 80,
      bg: "rgba(0,0,0,0.5)",
      borderColor: "#ffdf00",
      borderW: 2,
      radius: 40,
      opacity: 1,
    });
  }

  function addLogo() {
    if (!manual.logo_url) return;
    add({ tipo: "logo", src: manual.logo_url, x: 860, y: 920, w: 160, h: 120, opacity: 1 });
  }

  function aplicarFonteNaSelecao(nome: string) {
    setFonteSel(nome);
    const sel = selId ? composicao.camadas.find((c) => c.id === selId) : null;
    if (sel && sel.tipo === "texto") {
      dispatch({ type: "updateCamada", id: sel.id, patch: { font: nome } as Partial<Camada> });
    }
  }

  function onUploadFonte(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setErroFonte(null);
    startFonte(async () => {
      const fd = new FormData();
      fd.set("file", f);
      const r = await uploadFonteMarcaAction(clientId, papelFonte, fd);
      if ("error" in r) {
        setErroFonte(r.error);
        return;
      }
      // O server action devolve só {success}; reconstruímos a FonteMarca
      // localmente a partir do data URL pra injetar e usar de imediato.
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(f);
      });
      const nome = f.name.replace(/\.[^.]+$/, "");
      const format = formatoDeNome(f.name);
      const fonte: FonteMarca = { nome, papel: papelFonte, url: dataUrl, format };
      onFonteCarregada(fonte);
      aplicarFonteNaSelecao(nome);
    });
  }

  const camadasReverse = composicao.camadas.slice().reverse();

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* FOTO DE FUNDO */}
      <Section>
        <div className={secTitle}>Foto de fundo</div>
        <button
          type="button"
          onClick={() => fotoInputRef.current?.click()}
          disabled={pendingFoto}
          className="mb-2 flex w-full flex-col items-center gap-1 rounded-md border border-dashed py-3 text-xs text-muted-foreground hover:border-primary disabled:opacity-50"
        >
          <ImageIcon className="h-5 w-5" />
          {pendingFoto ? "Carregando…" : "Adicionar foto"}
        </button>
        {erroFoto && <div className="mb-1 text-[10px] text-destructive">{erroFoto}</div>}
        <input ref={fotoInputRef} type="file" accept="image/*" className="hidden" onChange={onFoto} />
        {fotoAtual && (
          <div className="space-y-1.5">
            <Slider l="Zoom" min={50} max={250} value={Math.round(fotoAtual.zoom * 100)} suffix="%" onChange={(v) => atuFoto({ zoom: v / 100 })} />
            <Slider l="Mover ↕" min={-300} max={300} value={fotoAtual.y} onChange={(v) => atuFoto({ y: v })} />
            <Slider l="Mover ↔" min={-300} max={300} value={fotoAtual.x} onChange={(v) => atuFoto({ x: v })} />
            <Slider l="Opacid." min={5} max={100} value={Math.round(fotoAtual.opacidade * 100)} suffix="%" onChange={(v) => atuFoto({ opacidade: v / 100 })} />
            <button
              type="button"
              onClick={() => dispatch({ type: "setFoto", foto: null })}
              className="text-[10px] text-destructive hover:underline"
            >
              Remover foto
            </button>
          </div>
        )}
      </Section>

      {/* FUNDO */}
      <Section>
        <div className={secTitle}>Fundo</div>
        <div className="mb-2 flex items-center gap-2">
          <span className="flex-1 text-[11px] text-muted-foreground">Cor do fundo</span>
          <input
            type="color"
            className="h-7 w-9 rounded border bg-transparent p-0.5"
            value={composicao.fundo.cor.startsWith("#") ? composicao.fundo.cor : "#062e10"}
            onChange={(e) => dispatch({ type: "setBg", cor: e.target.value })}
          />
        </div>
        <div className="mb-2 flex flex-wrap gap-1">
          {PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => dispatch({ type: "setBg", cor: c })}
              className="h-6 w-6 rounded border hover:scale-110"
              style={{ background: c }}
              title={c}
            />
          ))}
        </div>
        {manual.paletas.length > 0 && (
          <>
            <div className={secTitle}>Paleta da marca</div>
            <div className="mb-2 flex flex-wrap gap-1">
              {manual.paletas.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => dispatch({ type: "setBg", cor: c })}
                  className="h-6 w-6 rounded border hover:scale-110"
                  style={{ background: c }}
                  title={c}
                />
              ))}
            </div>
          </>
        )}
        <div className={secTitle}>Listras topo/base</div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => dispatch({ type: "toggleListras", show: true })}
            className={`flex-1 rounded border py-1.5 text-[11px] ${composicao.fundo.listras ? "border-primary bg-primary/10" : "bg-card hover:border-primary"}`}
          >
            Mostrar
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: "toggleListras", show: false })}
            className={`flex-1 rounded border py-1.5 text-[11px] ${!composicao.fundo.listras ? "border-primary bg-primary/10" : "bg-card hover:border-primary"}`}
          >
            Ocultar
          </button>
        </div>
      </Section>

      {/* ADICIONAR ELEMENTOS */}
      <Section>
        <div className={secTitle}>Adicionar elementos</div>
        <div className="grid grid-cols-3 gap-1.5">
          <button type="button" className={btnElem} onClick={addTexto}>
            <Type className="h-4 w-4" /> Texto
          </button>
          <button type="button" className={btnElem} onClick={() => addShape("rect")}>
            <Square className="h-4 w-4" /> Retângulo
          </button>
          <button type="button" className={btnElem} onClick={() => addShape("circle")}>
            <Circle className="h-4 w-4" /> Círculo
          </button>
          <button type="button" className={btnElem} onClick={() => addShape("line")}>
            <Minus className="h-4 w-4" /> Linha
          </button>
          <button type="button" className={btnElem} disabled={pendingImg} onClick={() => imgInputRef.current?.click()}>
            <ImageIcon className="h-4 w-4" /> {pendingImg ? "…" : "Imagem"}
          </button>
          <button type="button" className={btnElem} onClick={addBadge}>
            <Star className="h-4 w-4" /> Badge
          </button>
          <button type="button" className={`${btnElem} col-span-3`} onClick={addLogo} disabled={!manual.logo_url}>
            <ImageIcon className="h-4 w-4" /> {manual.logo_url ? "Logo da marca" : "Logo (não cadastrada)"}
          </button>
        </div>
        <input ref={imgInputRef} type="file" accept="image/*" className="hidden" onChange={onImagem} />
        {erroImg && <div className="mt-1 text-[10px] text-destructive">{erroImg}</div>}
      </Section>

      {/* FONTES */}
      <Section>
        <div className={secTitle}>Fontes</div>
        <select
          className="mb-1.5 w-full rounded-md border bg-card px-2 py-1.5 text-xs outline-none focus:border-primary"
          value={fonteSel}
          onChange={(e) => aplicarFonteNaSelecao(e.target.value)}
        >
          {todasFontes.length > 0 && (
            <optgroup label="Marca">
              {todasFontes.map((f) => (
                <option key={f.nome} value={f.nome}>
                  {f.nome} ({f.papel})
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label="Web">
            {fontesWeb.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </optgroup>
        </select>
        <div className="mb-1 flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">Papel:</span>
          <button
            type="button"
            onClick={() => setPapelFonte("titulo")}
            className={`rounded border px-2 py-0.5 text-[10px] ${papelFonte === "titulo" ? "border-primary bg-primary/10 text-primary" : "bg-card hover:border-primary"}`}
          >
            título
          </button>
          <button
            type="button"
            onClick={() => setPapelFonte("corpo")}
            className={`rounded border px-2 py-0.5 text-[10px] ${papelFonte === "corpo" ? "border-primary bg-primary/10 text-primary" : "bg-card hover:border-primary"}`}
          >
            corpo
          </button>
        </div>
        <button
          type="button"
          onClick={() => fonteInputRef.current?.click()}
          disabled={pendingFonte}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border bg-card py-1.5 text-[11px] hover:border-primary disabled:opacity-50"
        >
          <Upload className="h-3.5 w-3.5" />
          {pendingFonte ? "Carregando…" : "Carregar fonte (.ttf/.otf)"}
        </button>
        <input
          ref={fonteInputRef}
          type="file"
          accept=".ttf,.otf,.woff,.woff2"
          className="hidden"
          onChange={onUploadFonte}
        />
        {erroFonte && <div className="mt-1 text-[10px] text-destructive">{erroFonte}</div>}
        {fontesExtra.length > 0 && (
          <div className="mt-1 text-[10px] text-primary">
            {fontesExtra.map((f) => f.nome).join(", ")} carregada(s)
          </div>
        )}
      </Section>

      {/* CAMADAS */}
      <Section last>
        <div className={secTitle}>Camadas</div>
        <div className="flex flex-col gap-1">
          {camadasReverse.length === 0 && (
            <p className="text-[11px] text-muted-foreground">Nenhuma camada ainda.</p>
          )}
          {camadasReverse.map((c) => (
            <div
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={`flex cursor-pointer items-center gap-2 rounded border px-2 py-1.5 text-[11px] ${
                c.id === selId ? "border-primary" : "bg-card hover:border-primary"
              }`}
            >
              <span className="w-4 text-center">
                {c.tipo === "texto" ? "T" : c.tipo === "shape" ? "▢" : c.tipo === "logo" ? "L" : "🖼"}
              </span>
              <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                {c.tipo === "texto" ? c.text.slice(0, 18) || "(texto)" : c.tipo}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch({ type: "removeCamada", id: c.id });
                  if (selId === c.id) onSelect(null);
                }}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({ children, last }: { children: React.ReactNode; last?: boolean }) {
  return <div className={`p-3 ${last ? "" : "border-b"}`}>{children}</div>;
}

function Slider({
  l,
  min,
  max,
  value,
  suffix,
  onChange,
}: {
  l: string;
  min: number;
  max: number;
  value: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-[10px] text-muted-foreground">{l}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-primary"
      />
      <span className="w-9 text-right text-[10px]">
        {value}
        {suffix ?? ""}
      </span>
    </div>
  );
}

function formatoDeNome(name: string): FonteMarca["format"] {
  const l = name.toLowerCase();
  if (l.endsWith(".otf")) return "opentype";
  if (l.endsWith(".woff2")) return "woff2";
  if (l.endsWith(".woff")) return "woff";
  return "truetype";
}
