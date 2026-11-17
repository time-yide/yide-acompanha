"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ExternalLink, FolderOpen, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { confirmDriveUpload, prepareDriveUpload } from "@/lib/google-drive/actions";
import {
  CATEGORIAS_VIDEO,
  DRIVE_UPLOAD_MAX_ARQUIVOS,
  DRIVE_UPLOAD_MAX_BYTES,
  escolherLinkEntrega,
  hrefPastaDrive,
  isArquivoVideo,
  mimeVideo,
  type CategoriaVideo,
} from "@/lib/google-drive/naming";

type Fase = "idle" | "preparando" | "enviando" | "fim";

interface Progresso {
  nome: string;
  driveFileName: string;
  pct: number;
  status: "pendente" | "enviando" | "ok" | "erro";
  erro?: string;
}

export interface DriveUploadConcluido {
  /** Link pra colar na entrega (pasta da categoria, ou do mês se houve mais de uma). */
  linkEntrega: string;
  /** Vídeos que subiram neste envio. */
  enviados: number;
}

interface Props {
  clientId: string | null;
  /** "YYYY-MM-DD" — define a pasta do mês (ex.: data da captação). */
  dataReferencia: string;
  /** Página avulsa: avisa o editor do cliente quando termina. */
  notificarEditor?: boolean;
  onConcluido?: (r: DriveUploadConcluido) => void;
  onEnviandoChange?: (enviando: boolean) => void;
  className?: string;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Seleção de categoria + arrastar vídeos + envio direto pro Google Drive.
 * O servidor só cria as pastas e abre a sessão resumável; o PUT do arquivo
 * sai do navegador direto pro Google (sem limite de corpo da Vercel).
 */
export function DriveUploader({
  clientId,
  dataReferencia,
  notificarEditor = false,
  onConcluido,
  onEnviandoChange,
  className,
}: Props) {
  const [categoria, setCategoria] = useState<CategoriaVideo>("reels");
  const [files, setFiles] = useState<File[]>([]);
  const [progresso, setProgresso] = useState<Progresso[]>([]);
  const [fase, setFase] = useState<Fase>("idle");
  const [pasta, setPasta] = useState<{ url: string; caminho: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const envios = useRef<Array<{ folderUrl: string; mesFolderUrl: string }>>([]);

  const ocupado = fase === "preparando" || fase === "enviando";

  useEffect(() => {
    onEnviandoChange?.(ocupado);
    if (!ocupado) return;
    const aviso = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [ocupado, onEnviandoChange]);

  const addFiles = useCallback((lista: FileList | File[]) => {
    const todos = Array.from(lista);
    const videos = todos.filter((f) => isArquivoVideo(f.name, f.type));
    if (videos.length < todos.length) toast.error("Só arquivos de vídeo — os outros foram ignorados");
    const grandes = videos.filter((f) => f.size > DRIVE_UPLOAD_MAX_BYTES);
    if (grandes.length > 0) toast.error(`Arquivo maior que 10 GB ignorado: ${grandes[0].name}`);
    const ok = videos.filter((f) => f.size > 0 && f.size <= DRIVE_UPLOAD_MAX_BYTES);
    setFiles((prev) => {
      const next = [...prev, ...ok];
      if (next.length > DRIVE_UPLOAD_MAX_ARQUIVOS) {
        toast.error(`No máximo ${DRIVE_UPLOAD_MAX_ARQUIVOS} vídeos por envio`);
        return next.slice(0, DRIVE_UPLOAD_MAX_ARQUIVOS);
      }
      return next;
    });
    if (fase === "fim") { setFase("idle"); setProgresso([]); }
  }, [fase]);

  async function enviar() {
    if (!clientId) { toast.error("Selecione o cliente antes de subir os vídeos"); return; }
    if (files.length === 0) return;
    const lote = files;
    setFase("preparando");

    const prep = await prepareDriveUpload({
      clientId,
      categoria,
      dataReferencia,
      notificarEditor,
      files: lote.map((f) => ({ name: f.name, size: f.size, type: f.type })),
    }).catch(() => ({ error: "Falha de conexão ao preparar o envio" }));

    if ("error" in prep) {
      toast.error(prep.error);
      setFase("idle");
      return;
    }

    const pastaHref = hrefPastaDrive(prep.folderUrl);
    if (pastaHref) setPasta({ url: pastaHref, caminho: prep.caminho });
    setProgresso(prep.uploads.map((u, i) => ({ nome: lote[i].name, driveFileName: u.driveFileName, pct: 0, status: "pendente" })));
    setFase("enviando");

    const atualizar = (i: number, patch: Partial<Progresso>) =>
      setProgresso((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

    const concluidos: Array<{ originalName: string; driveFileName: string; driveFileId: string | null; sizeBytes: number }> = [];
    for (let i = 0; i < prep.uploads.length; i++) {
      const up = prep.uploads[i];
      const file = lote[i];
      atualizar(i, { status: "enviando" });
      try {
        const fileId = await putComProgresso(up.uploadUri, file, (pct) => atualizar(i, { pct }));
        atualizar(i, { status: "ok", pct: 100 });
        concluidos.push({ originalName: up.originalName, driveFileName: up.driveFileName, driveFileId: fileId, sizeBytes: file.size });
      } catch (err) {
        atualizar(i, { status: "erro", erro: err instanceof Error ? err.message : "Erro no envio" });
      }
    }

    const paraConfirmar = concluidos.flatMap((c) => (c.driveFileId ? [{ driveFileName: c.driveFileName, driveFileId: c.driveFileId }] : []));
    if (paraConfirmar.length > 0) {
      await confirmDriveUpload({ token: prep.token, files: paraConfirmar }).catch(() => undefined);
    }
    if (concluidos.length > 0) {
      envios.current.push({ folderUrl: prep.folderUrl, mesFolderUrl: prep.mesFolderUrl });
      const link = escolherLinkEntrega(envios.current);
      if (link) onConcluido?.({ linkEntrega: link, enviados: concluidos.length });
    }

    // Mantém na lista só o que falhou, pra tentar de novo.
    const falhas = new Set(prep.uploads.map((u, i) => (concluidos.some((c) => c.driveFileName === u.driveFileName) ? -1 : i)));
    setFiles(lote.filter((_, i) => falhas.has(i)));
    setFase("fim");

    if (concluidos.length === lote.length) {
      toast.success(`${concluidos.length} vídeo(s) no Drive`);
    } else {
      toast.error(`${concluidos.length}/${lote.length} enviados — tente de novo os que falharam`);
    }
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="space-y-1.5">
        <label htmlFor="drive-categoria" className="block text-sm font-medium">Categoria</label>
        <select
          id="drive-categoria"
          value={categoria}
          onChange={(e) => setCategoria(e.target.value as CategoriaVideo)}
          disabled={ocupado}
          className="block h-9 w-full rounded-md border bg-card px-2 text-sm"
        >
          {CATEGORIAS_VIDEO.map((c) => (
            <option key={c.value} value={c.value}>{c.pasta}</option>
          ))}
        </select>
      </div>

      <div
        role="button"
        tabIndex={0}
        className={cn(
          "rounded-lg border-2 border-dashed p-6 text-center transition-colors",
          ocupado ? "cursor-not-allowed opacity-60" : "cursor-pointer",
          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50",
        )}
        onDragOver={(e) => { e.preventDefault(); if (!ocupado) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (!ocupado) addFiles(e.dataTransfer.files); }}
        onClick={() => { if (!ocupado) inputRef.current?.click(); }}
        onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !ocupado) { e.preventDefault(); inputRef.current?.click(); } }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="video/*,.mp4,.mov,.avi,.mkv,.webm,.m4v,.mts"
          className="hidden"
          onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
          disabled={ocupado}
        />
        <Upload className="mx-auto h-8 w-8 text-muted-foreground/60" />
        <p className="mt-2 text-sm text-muted-foreground">Arraste os vídeos aqui ou clique pra selecionar</p>
        <p className="mt-0.5 text-xs text-muted-foreground/70">MP4, MOV, MKV, WebM… até 10 GB cada</p>
      </div>

      {files.length > 0 && fase !== "enviando" && fase !== "preparando" && (
        <ul className="divide-y rounded-md border text-sm">
          {files.map((f, i) => (
            <li key={`${f.name}-${f.size}-${i}`} className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="min-w-0 truncate">
                <span className="font-medium">{f.name}</span>
                <span className="ml-2 text-muted-foreground">{formatBytes(f.size)}</span>
              </span>
              <button
                type="button"
                onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                className="shrink-0 text-muted-foreground hover:text-destructive"
                aria-label={`Remover ${f.name}`}
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {progresso.length > 0 && (
        <ul className="divide-y rounded-md border text-sm">
          {progresso.map((p, i) => (
            <li key={`${p.driveFileName}-${i}`} className="space-y-1.5 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate">
                  {p.nome}
                  <span className="ml-1 text-muted-foreground">→ {p.driveFileName}</span>
                </span>
                <span className="shrink-0">
                  {p.status === "ok" && <Check className="h-4 w-4 text-green-600" />}
                  {p.status === "enviando" && <span className="text-xs tabular-nums text-muted-foreground">{p.pct}%</span>}
                  {p.status === "erro" && <X className="h-4 w-4 text-destructive" />}
                  {p.status === "pendente" && <span className="text-xs text-muted-foreground">aguardando</span>}
                </span>
              </div>
              {(p.status === "enviando" || p.status === "ok") && (
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${p.pct}%` }} />
                </div>
              )}
              {p.erro && <p className="text-xs text-destructive">{p.erro}</p>}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {fase === "preparando" ? (
          <Button type="button" disabled className="gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Criando pastas no Drive…
          </Button>
        ) : fase === "enviando" ? (
          <Button type="button" disabled className="gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Enviando…
          </Button>
        ) : (
          <Button type="button" onClick={enviar} disabled={!clientId || files.length === 0} className="gap-2">
            <Upload className="h-4 w-4" />
            {files.length > 0 ? `Subir ${files.length} vídeo(s) pro Drive` : "Subir vídeos pro Drive"}
          </Button>
        )}
        {pasta && (
          <a href={pasta.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
            <FolderOpen className="h-4 w-4" /> {pasta.caminho} <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
      {!clientId && <p className="text-xs text-muted-foreground">Selecione o cliente pra liberar o envio.</p>}
    </div>
  );
}

/** PUT do arquivo inteiro na URI da sessão resumável. Devolve o id do arquivo no Drive. */
function putComProgresso(uploadUri: string, file: File, onProgress: (pct: number) => void): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUri, true);
    xhr.setRequestHeader("Content-Type", mimeVideo(file.name));
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const body = JSON.parse(xhr.responseText) as { id?: string };
          resolve(body.id ?? null);
        } catch {
          resolve(null);
        }
      } else {
        reject(new Error(`Drive recusou o envio (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Erro de rede no envio"));
    xhr.send(file);
  });
}
