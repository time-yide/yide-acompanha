"use client";

import { useState, useTransition, useRef, type ComponentType } from "react";
import {
  Upload, X, Check,
  LayoutGrid, GalleryHorizontalEnd, Circle, Clapperboard, ImagePlus,
} from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  createSocialPostAction, updateSocialPostAction,
  prepareSocialMidiaUploadAction, finalizeSocialMidiaUploadAction,
} from "@/lib/social-media/actions";
import { createClient } from "@/lib/supabase/client";
import { REDES, FORMATOS, STATUS_DEFS } from "@/lib/social-media/tipos";
import { brtInputToUtcIso, utcIsoToBrtInputValue } from "@/lib/calendario/timezone";
import type { SocialPostRow } from "@/lib/social-media/queries";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string;
  post?: SocialPostRow | null;
  /** Pré-preenche data ao criar (do click no calendário). */
  defaultDate?: string;
}

type IconType = ComponentType<{ className?: string }>;

/**
 * Ícones de marca inline (SVG monocromático, herdam a cor via currentColor).
 * O lucide desta versão não exporta glifos de marca (trademark), então usamos
 * os paths do Simple Icons.
 */
function makeBrandIcon(path: string): IconType {
  function BrandIcon({ className }: { className?: string }) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
        <path d={path} />
      </svg>
    );
  }
  return BrandIcon;
}

/** Ícone por rede. */
const REDE_ICON: Record<string, IconType> = {
  instagram: makeBrandIcon(
    "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z",
  ),
  facebook: makeBrandIcon(
    "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
  ),
  linkedin: makeBrandIcon(
    "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z",
  ),
  tiktok: makeBrandIcon(
    "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z",
  ),
  youtube: makeBrandIcon(
    "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z",
  ),
  gmn: makeBrandIcon(
    "M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z",
  ),
};

/** Ícone por formato de post. */
const FORMATO_ICON: Record<string, IconType> = {
  feed: LayoutGrid,
  carrossel: GalleryHorizontalEnd,
  story: Circle,
  reels: Clapperboard,
};

/**
 * Converte ISO UTC → string pra <input type=datetime-local>, sempre no fuso
 * da app (Cuiabá). Antes usava getTimezoneOffset() do browser, o que fazia
 * usuários em fusos diferentes verem horários diferentes pro mesmo timestamp.
 */
function isoToDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  return utcIsoToBrtInputValue(iso);
}

/**
 * Converte string do <input type=datetime-local> → ISO UTC. Sempre interpreta
 * a entrada como sendo no fuso da app, independente de onde o colaborador
 * está. Dois colaboradores que digitam "14:00" salvam o MESMO timestamp.
 */
function datetimeLocalToIso(value: string): string | null {
  if (!value) return null;
  try {
    return brtInputToUtcIso(value);
  } catch {
    return null;
  }
}

export function PostFormModal({ open, onOpenChange, clientId, post, defaultDate }: Props) {
  const isEdit = !!post;
  const [formato, setFormato] = useState<string>(post?.formato ?? "feed");
  const [status, setStatus] = useState<string>(post?.status ?? "rascunho");
  const [redes, setRedes] = useState<string[]>(post?.redes ?? ["instagram"]);
  const [legenda, setLegenda] = useState<string>(post?.legenda ?? "");
  const [hashtags, setHashtags] = useState<string>(post?.hashtags ?? "");
  const [midias, setMidias] = useState<string[]>(post?.midias ?? []);
  const [agendar, setAgendar] = useState<string>(
    isoToDatetimeLocal(post?.agendar_para) || (defaultDate ? `${defaultDate}T10:00` : ""),
  );
  const [pending, startTransition] = useTransition();
  const [uploading, startUpload] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Capa do Reels: imagem própria OU um frame do vídeo (offset em ms).
  const [coverMode, setCoverMode] = useState<"imagem" | "video">(
    post?.reels_cover_url ? "imagem" : "video",
  );
  const [coverUrl, setCoverUrl] = useState<string>(post?.reels_cover_url ?? "");
  const [thumbOffsetMs, setThumbOffsetMs] = useState<number>(post?.reels_thumb_offset ?? 0);
  const [coverUploading, setCoverUploading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoDuration, setVideoDuration] = useState(0);

  const isVideoUrl = (url: string) => /\.(mp4|mov|webm)(\?|$)/i.test(url);
  const firstVideoUrl = midias.find(isVideoUrl) ?? "";
  const showCover = formato === "reels" && !!firstVideoUrl;

  /**
   * Sobe UM arquivo pro Storage (mesmo fluxo das mídias: prepare → uploadToSignedUrl
   * → finalize) e devolve a signed URL de leitura. Reusado pela capa do Reels.
   */
  async function uploadFile(file: File): Promise<string> {
    const supabase = createClient();
    const prep = await prepareSocialMidiaUploadAction(clientId, file.name, file.type, file.size);
    if ("error" in prep) throw new Error(prep.error);
    const { error: upErr } = await supabase.storage
      .from("social-media-creatives")
      .uploadToSignedUrl(prep.path, prep.token, file, { contentType: file.type });
    if (upErr) throw new Error(`Falha no upload: ${upErr.message}`);
    const fin = await finalizeSocialMidiaUploadAction(prep.path);
    if ("error" in fin) throw new Error(fin.error);
    return fin.url;
  }

  async function onCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setCoverUploading(true);
    try {
      const url = await uploadFile(file);
      setCoverUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro no upload da capa");
    } finally {
      setCoverUploading(false);
    }
  }

  function onScrub(seconds: number) {
    setThumbOffsetMs(Math.round(seconds * 1000));
    if (videoRef.current) videoRef.current.currentTime = seconds;
  }

  function fmtTime(seconds: number): string {
    const s = Math.max(0, Math.floor(seconds));
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  function toggleRede(value: string) {
    setRedes((prev) => prev.includes(value) ? prev.filter((r) => r !== value) : [...prev, value]);
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    e.target.value = "";

    startUpload(async () => {
      try {
        for (const file of files) {
          // O arquivo nunca trafega por Server Action (teto de 2MB/4,5MB que dava
          // tela preta com vídeo): uploadFile só gera token e o browser envia os
          // bytes direto pro Storage. Ver uploadFile().
          const url = await uploadFile(file);
          setMidias((prev) => [...prev, url]);
        }
      } catch (err) {
        // Rede caindo, action lançando, etc. Nunca deixa estourar pro error
        // boundary (a "tela preta com erro").
        setError(
          err instanceof Error
            ? `Erro no upload: ${err.message}`
            : "Erro inesperado no upload",
        );
      }
    });
  }

  function removerMidia(idx: number) {
    setMidias((prev) => prev.filter((_, i) => i !== idx));
  }


  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("client_id", clientId);
    fd.set("formato", formato);
    fd.set("status", status);
    fd.set("redes", JSON.stringify(redes));
    fd.set("midias", JSON.stringify(midias));
    // Capa do Reels: só envia quando é reels; manda cover_url OU thumb_offset (nunca ambos).
    if (showCover) {
      if (coverMode === "imagem" && coverUrl) {
        fd.set("reels_cover_url", coverUrl);
      } else if (coverMode === "video") {
        fd.set("reels_thumb_offset", String(thumbOffsetMs));
      }
    }
    const isoAgendar = datetimeLocalToIso(agendar);
    if (isoAgendar) fd.set("agendar_para", isoAgendar);
    if (isEdit && post) fd.set("id", post.id);

    startTransition(async () => {
      const r = isEdit ? await updateSocialPostAction(fd) : await createSocialPostAction(fd);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Editar post" : "Novo post"}</DialogTitle>
          </DialogHeader>

          {/* Mídias primeiro */}
          <div className="space-y-2">
            <Label>Mídias *</Label>
            {midias.length === 0 ? (
              // Vazio: dropzone grande e convidativo
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/30 bg-primary/[0.03] px-4 py-8 text-center transition-colors hover:border-primary/50 hover:bg-primary/[0.06]">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                  {uploading ? <Upload className="h-5 w-5 animate-pulse" /> : <ImagePlus className="h-5 w-5" />}
                </span>
                <span className="text-sm font-medium">
                  {uploading ? "Enviando..." : "Arraste ou clique para enviar"}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  JPG/PNG/WebP/GIF/MP4/MOV · até 50MB · carrossel = várias imagens
                </span>
                <input type="file" multiple accept="image/*,video/*" className="hidden" onChange={onUpload} disabled={uploading} />
              </label>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {midias.map((url, i) => (
                    <div key={i} className="group relative aspect-square overflow-hidden rounded-lg border bg-muted/40">
                      {url.match(/\.(mp4|mov|webm)$/i) ? (
                        <video src={url} muted className="h-full w-full object-cover" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt={`Mídia ${i + 1}`} className="h-full w-full object-cover" />
                      )}
                      {i === 0 && (
                        <span className="absolute bottom-1 left-1 rounded bg-background/80 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                          capa
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removerMidia(i)}
                        className="absolute top-1 right-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-background/80 text-destructive opacity-0 transition-opacity hover:bg-destructive hover:text-white group-hover:opacity-100"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 text-[10px] text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/40">
                    {uploading ? <span>Enviando...</span> : <><Upload className="h-4 w-4" /><span>Adicionar</span></>}
                    <input type="file" multiple accept="image/*,video/*" className="hidden" onChange={onUpload} disabled={uploading} />
                  </label>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  A 1ª mídia é a capa · JPG/PNG/WebP/GIF/MP4/MOV · até 50MB
                </p>
              </>
            )}
          </div>

          {/* Título interno */}
          <div className="space-y-1.5">
            <Label htmlFor="titulo">Título interno (opcional)</Label>
            <Input
              id="titulo"
              name="titulo"
              defaultValue={post?.titulo ?? ""}
              placeholder="Ex.: BlackFriday Slide 1"
              maxLength={200}
            />
            <p className="text-[10px] text-muted-foreground">Só pra você organizar, não vai aparecer no post.</p>
          </div>

          {/* Formato como chips visuais */}
          <div className="space-y-2">
            <Label>Formato</Label>
            <div className="grid grid-cols-2 gap-2">
              {FORMATOS.map((f) => {
                const Icon = FORMATO_ICON[f.value];
                const active = formato === f.value;
                return (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setFormato(f.value)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border p-2.5 text-left transition-all",
                      active
                        ? "border-primary bg-primary/10 ring-1 ring-inset ring-primary/30"
                        : "border-border bg-card hover:bg-muted/40",
                    )}
                  >
                    {Icon && <Icon className={cn("h-5 w-5 shrink-0", active ? "text-primary" : "text-muted-foreground")} />}
                    <span className="min-w-0">
                      <span className={cn("block text-sm font-medium leading-tight", active ? "text-primary" : "text-foreground")}>
                        {f.label}
                      </span>
                      <span className="block truncate text-[10px] text-muted-foreground">{f.descricao}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status + Data/hora */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v ?? "rascunho")}>
                <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_DEFS).map(([v, def]) => (
                    <SelectItem key={v} value={v}>{def.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="agendar_para">Data/hora</Label>
              <Input
                id="agendar_para"
                type="datetime-local"
                className="w-full"
                value={agendar}
                onChange={(e) => setAgendar(e.target.value)}
              />
            </div>
          </div>

          {/* Redes: pílulas com ícone da marca (quebram linha, sem amontoar) */}
          <div className="space-y-2">
            <Label>Publicar em *</Label>
            <div className="flex flex-wrap gap-2">
              {REDES.map((r) => {
                const Icon = REDE_ICON[r.value];
                const active = redes.includes(r.value);
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => toggleRede(r.value)}
                    aria-pressed={active}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                      active
                        ? cn(r.color, "ring-1 ring-inset")
                        : "border-border bg-card text-muted-foreground hover:bg-muted/40",
                    )}
                  >
                    {Icon && <Icon className="h-4 w-4 shrink-0" />}
                    <span className="whitespace-nowrap">{r.label}</span>
                    {active && <Check className="h-3.5 w-3.5 shrink-0" />}
                    {r.comingSoon && (
                      <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 text-[9px] leading-tight text-amber-600 dark:text-amber-300">
                        Fase 4
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Capa do Reels: imagem própria OU um frame do vídeo */}
          {showCover && (
            <div className="space-y-3 rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>Capa do Reels</Label>
                <div className="inline-flex overflow-hidden rounded-md border text-xs">
                  <button
                    type="button"
                    onClick={() => setCoverMode("imagem")}
                    className={`px-3 py-1.5 ${coverMode === "imagem" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted/40"}`}
                  >
                    Imagem
                  </button>
                  <button
                    type="button"
                    onClick={() => setCoverMode("video")}
                    className={`px-3 py-1.5 ${coverMode === "video" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted/40"}`}
                  >
                    Do vídeo
                  </button>
                </div>
              </div>

              {coverMode === "imagem" ? (
                <div className="space-y-2">
                  {coverUrl && (
                    <div className="relative aspect-[9/16] w-28 overflow-hidden rounded-md border bg-muted/40">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={coverUrl} alt="Capa do Reels" className="h-full w-full object-cover" />
                    </div>
                  )}
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-muted-foreground/40 bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/40">
                    {coverUploading ? <span>Enviando...</span> : <><Upload className="h-3.5 w-3.5" /><span>{coverUrl ? "Trocar imagem" : "Enviar imagem"}</span></>}
                    <input type="file" accept="image/*" className="hidden" onChange={onCoverUpload} disabled={coverUploading} />
                  </label>
                  <p className="text-[10px] text-muted-foreground">Recomendado 9:16. Vira a capa do Reels no feed.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="aspect-[9/16] w-28 overflow-hidden rounded-md border bg-black">
                    <video
                      ref={videoRef}
                      src={firstVideoUrl}
                      className="h-full w-full object-cover"
                      muted
                      playsInline
                      onLoadedMetadata={(e) => {
                        setVideoDuration(e.currentTarget.duration || 0);
                        e.currentTarget.currentTime = thumbOffsetMs / 1000;
                      }}
                    />
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={videoDuration || 0}
                    step={0.1}
                    value={thumbOffsetMs / 1000}
                    onChange={(e) => onScrub(Number(e.target.value))}
                    className="w-full"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Arraste pra escolher o frame — {fmtTime(thumbOffsetMs / 1000)} / {fmtTime(videoDuration)}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Legenda */}
          <div className="space-y-1.5">
            <Label htmlFor="legenda">Legenda</Label>
            <Textarea
              id="legenda"
              name="legenda"
              rows={5}
              value={legenda}
              onChange={(e) => setLegenda(e.target.value)}
              placeholder="Texto principal do post..."
              maxLength={4000}
            />
          </div>

          {/* Hashtags + 1º comentário */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="hashtags">Hashtags</Label>
              <Textarea
                id="hashtags"
                name="hashtags"
                rows={2}
                value={hashtags}
                onChange={(e) => setHashtags(e.target.value)}
                placeholder="#blackfriday #marketing"
                maxLength={2000}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="primeiro_comentario">1º comentário</Label>
              <Textarea
                id="primeiro_comentario"
                name="primeiro_comentario"
                rows={2}
                defaultValue={post?.primeiro_comentario ?? ""}
                placeholder="Comentário automático após publicar"
                maxLength={2000}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              name="observacoes"
              rows={2}
              defaultValue={post?.observacoes ?? ""}
              maxLength={2000}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending || uploading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || uploading || midias.length === 0 || redes.length === 0}>
              {pending ? "Salvando..." : isEdit ? "Salvar alterações" : "Criar post"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
