"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, FolderOpen, Check, X, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import {
  prepareUpload,
  confirmUpload,
  CATEGORIAS_VIDEO,
  type CategoriaVideo,
} from "@/lib/google-drive/actions";

type UploadStatus = "idle" | "preparing" | "uploading" | "done" | "error";

interface FileProgress {
  file: File;
  driveFileName: string;
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

interface RecentUpload {
  id: string;
  categoria: string;
  nome_original: string;
  nome_drive: string;
  size_bytes: number | null;
  folder_url: string;
  created_at: string;
  client: { nome: string } | null;
  uploader: { nome: string } | null;
}

interface Props {
  clients: SearchableOption[];
  recentUploads: RecentUpload[];
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

export function UploadDriveView({ clients, recentUploads }: Props) {
  const [clientId, setClientId] = useState<string | null>(null);
  const [categoria, setCategoria] = useState<CategoriaVideo>("Reels");
  const [files, setFiles] = useState<File[]>([]);
  const [fileProgress, setFileProgress] = useState<FileProgress[]>([]);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [folderUrl, setFolderUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles).filter(
      (f) => f.type.startsWith("video/") || f.name.match(/\.(mp4|mov|avi|mkv|webm|m4v)$/i),
    );
    if (arr.length === 0) {
      toast.error("Selecione arquivos de vídeo");
      return;
    }
    setFiles((prev) => [...prev, ...arr]);
  }, []);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const handleUpload = async () => {
    if (!clientId || files.length === 0) return;

    setStatus("preparing");

    try {
      const result = await prepareUpload({
        clientId,
        categoria,
        files: files.map((f) => ({ name: f.name, size: f.size, type: f.type || "video/mp4" })),
      });

      if ("error" in result) {
        toast.error(result.error);
        setStatus("error");
        return;
      }

      setFolderUrl(result.folderUrl);
      setStatus("uploading");

      const progresses: FileProgress[] = result.uploads.map((u, i) => ({
        file: files[i],
        driveFileName: u.driveFileName,
        progress: 0,
        status: "pending" as const,
      }));
      setFileProgress(progresses);

      const completedFiles: { originalName: string; driveFileName: string; sizeBytes: number }[] = [];

      for (let i = 0; i < result.uploads.length; i++) {
        const upload = result.uploads[i];
        const file = files[i];

        setFileProgress((prev) =>
          prev.map((p, idx) => (idx === i ? { ...p, status: "uploading" } : p)),
        );

        try {
          await uploadFileWithProgress(upload.uploadUri, file, (pct) => {
            setFileProgress((prev) =>
              prev.map((p, idx) => (idx === i ? { ...p, progress: pct } : p)),
            );
          });

          setFileProgress((prev) =>
            prev.map((p, idx) => (idx === i ? { ...p, status: "done", progress: 100 } : p)),
          );

          completedFiles.push({
            originalName: upload.originalName,
            driveFileName: upload.driveFileName,
            sizeBytes: file.size,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Erro no upload";
          setFileProgress((prev) =>
            prev.map((p, idx) => (idx === i ? { ...p, status: "error", error: msg } : p)),
          );
        }
      }

      if (completedFiles.length > 0) {
        await confirmUpload({
          clientId,
          categoria,
          folderUrl: result.folderUrl,
          files: completedFiles,
        });
      }

      if (completedFiles.length === files.length) {
        setStatus("done");
        toast.success(`${completedFiles.length} vídeo(s) enviado(s) pro Drive`);
      } else {
        setStatus("error");
        toast.error(`${completedFiles.length}/${files.length} enviados — alguns falharam`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro inesperado";
      toast.error(msg);
      setStatus("error");
    }
  };

  const reset = () => {
    setFiles([]);
    setFileProgress([]);
    setStatus("idle");
    setFolderUrl(null);
  };

  const isUploading = status === "preparing" || status === "uploading";

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Subir vídeos pro Drive</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Selecione o cliente e a categoria — o sistema cria as pastas automaticamente.
        </p>
      </div>

      {/* Seleção de cliente e categoria */}
      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Cliente</label>
            <SearchableSelect
              options={clients}
              value={clientId}
              onChange={setClientId}
              placeholder="Buscar cliente..."
              disabled={isUploading}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Categoria</label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as CategoriaVideo)}
              disabled={isUploading}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              {CATEGORIAS_VIDEO.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Zona de arrastar/soltar arquivos */}
      {status !== "done" && (
        <Card
          className={`p-8 border-2 border-dashed transition-colors cursor-pointer ${
            dragOver
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !isUploading && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="video/*,.mp4,.mov,.avi,.mkv,.webm,.m4v"
            className="hidden"
            onChange={(e) => e.target.files && addFiles(e.target.files)}
            disabled={isUploading}
          />
          <div className="text-center">
            <Upload className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              Arraste vídeos aqui ou clique pra selecionar
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              MP4, MOV, AVI, MKV, WebM
            </p>
          </div>
        </Card>
      )}

      {/* Lista de arquivos selecionados */}
      {files.length > 0 && status === "idle" && (
        <Card className="divide-y">
          {files.map((file, i) => (
            <div key={`${file.name}-${i}`} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <div className="truncate flex-1 mr-3">
                <span className="font-medium">{file.name}</span>
                <span className="text-muted-foreground ml-2">{formatBytes(file.size)}</span>
              </div>
              <button
                onClick={() => removeFile(i)}
                className="text-muted-foreground hover:text-destructive shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </Card>
      )}

      {/* Progresso de upload */}
      {fileProgress.length > 0 && (status === "uploading" || status === "done" || status === "error") && (
        <Card className="divide-y">
          {fileProgress.map((fp, i) => (
            <div key={i} className="px-4 py-3">
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="truncate flex-1 mr-2">
                  {fp.file.name}
                  <span className="text-muted-foreground ml-1">→ {fp.driveFileName}</span>
                </span>
                <span className="shrink-0">
                  {fp.status === "done" && <Check className="h-4 w-4 text-green-600" />}
                  {fp.status === "uploading" && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
                  {fp.status === "error" && <X className="h-4 w-4 text-destructive" />}
                  {fp.status === "pending" && <span className="text-muted-foreground text-xs">aguardando</span>}
                </span>
              </div>
              {(fp.status === "uploading" || fp.status === "done") && (
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-300"
                    style={{ width: `${fp.progress}%` }}
                  />
                </div>
              )}
              {fp.error && <p className="text-xs text-destructive mt-1">{fp.error}</p>}
            </div>
          ))}
        </Card>
      )}

      {/* Botão de ação */}
      <div className="flex items-center gap-3">
        {status === "idle" && (
          <Button
            onClick={handleUpload}
            disabled={!clientId || files.length === 0}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            Subir {files.length > 0 ? `${files.length} vídeo(s)` : "vídeos"} pro Drive
          </Button>
        )}
        {status === "preparing" && (
          <Button disabled className="gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Criando pastas no Drive...
          </Button>
        )}
        {status === "uploading" && (
          <Button disabled className="gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Enviando...
          </Button>
        )}
        {(status === "done" || status === "error") && (
          <>
            <Button onClick={reset} variant="outline">
              Enviar mais vídeos
            </Button>
            {folderUrl && (
              <a href={folderUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="gap-2">
                  <FolderOpen className="h-4 w-4" />
                  Abrir pasta no Drive
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </a>
            )}
          </>
        )}
      </div>

      {/* Histórico recente */}
      {recentUploads.length > 0 && (
        <div>
          <h2 className="text-sm font-medium mb-2">Uploads recentes</h2>
          <Card className="divide-y max-h-80 overflow-y-auto">
            {recentUploads.map((u) => (
              <div key={u.id} className="px-4 py-2.5 text-sm flex items-center justify-between gap-2">
                <div className="truncate flex-1">
                  <span className="font-medium">{u.client?.nome ?? "—"}</span>
                  <span className="text-muted-foreground ml-2">{u.categoria}</span>
                  <span className="text-muted-foreground ml-2">·</span>
                  <span className="text-muted-foreground ml-2">{u.nome_drive}</span>
                  <span className="text-muted-foreground/70 ml-2 text-xs">{formatBytes(u.size_bytes)}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground">{formatDate(u.created_at)}</span>
                  <a href={u.folder_url} target="_blank" rel="noopener noreferrer" title="Abrir pasta">
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                  </a>
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}

async function uploadFileWithProgress(
  uploadUri: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUri, true);
    xhr.setRequestHeader("Content-Type", file.type || "video/mp4");

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload falhou: ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error("Erro de rede no upload"));
    xhr.send(file);
  });
}
