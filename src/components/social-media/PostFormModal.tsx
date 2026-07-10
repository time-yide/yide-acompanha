"use client";

import { useState, useTransition, useRef } from "react";
import { Upload, X, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  createSocialPostAction, updateSocialPostAction,
  prepareSocialMidiaUploadAction, finalizeSocialMidiaUploadAction,
  gerarLegendaIaAction,
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
  const [briefIa, setBriefIa] = useState<string>("");
  const [gerandoIa, setGerandoIa] = useState(false);
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

  async function onGerarIa(modo: "gerar" | "melhorar") {
    setError(null);
    setGerandoIa(true);
    try {
      const r = await gerarLegendaIaAction({
        client_id: clientId,
        brief: modo === "gerar" ? briefIa : null,
        rascunho: modo === "melhorar" ? legenda : null,
        formato,
        redes,
      });
      if ("error" in r) {
        setError(r.error);
        return;
      }
      setLegenda(r.legenda);
      setHashtags(r.hashtags);
    } finally {
      setGerandoIa(false);
    }
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
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {midias.map((url, i) => (
                <div key={i} className="relative aspect-square overflow-hidden rounded-md border bg-muted/40">
                  {url.match(/\.(mp4|mov|webm)$/i) ? (
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    <video src={url} className="h-full w-full object-cover" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt={`Mídia ${i + 1}`} className="h-full w-full object-cover" />
                  )}
                  <button
                    type="button"
                    onClick={() => removerMidia(i)}
                    className="absolute top-1 right-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-background/80 text-destructive hover:bg-destructive hover:text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-muted-foreground/30 bg-muted/20 text-[10px] text-muted-foreground hover:bg-muted/40">
                {uploading ? <span>Enviando...</span> : <><Upload className="h-4 w-4" /><span>Enviar</span></>}
                <input type="file" multiple accept="image/*,video/*" className="hidden" onChange={onUpload} disabled={uploading} />
              </label>
            </div>
            <p className="text-[10px] text-muted-foreground">
              JPG/PNG/WebP/GIF/MP4/MOV. Max 50MB. Carrossel = múltiplas imagens.
            </p>
          </div>

          {/* Título interno + formato + status */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-3">
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

            <div className="space-y-1.5">
              <Label htmlFor="formato">Formato</Label>
              <Select value={formato} onValueChange={(v) => setFormato(v ?? "feed")}>
                <SelectTrigger id="formato"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORMATOS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
                value={agendar}
                onChange={(e) => setAgendar(e.target.value)}
              />
            </div>
          </div>

          {/* Redes */}
          <div className="space-y-1.5">
            <Label>Publicar em *</Label>
            <div className="flex flex-wrap gap-2">
              {REDES.map((r) => (
                <label
                  key={r.value}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs cursor-pointer ${redes.includes(r.value) ? r.color : "border-border bg-card text-muted-foreground"}`}
                >
                  <Checkbox
                    checked={redes.includes(r.value)}
                    onCheckedChange={() => toggleRede(r.value)}
                  />
                  {r.label}
                  {r.comingSoon && (
                    <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 text-[9px] text-amber-700 dark:text-amber-300">
                      Fase 4
                    </span>
                  )}
                </label>
              ))}
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

          {/* IA: gerar/melhorar legenda */}
          <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Gerar com IA
            </div>
            <Input
              value={briefIa}
              onChange={(e) => setBriefIa(e.target.value)}
              placeholder="Conte a ideia. Ex: promoção de Dia das Mães, 20% off até domingo"
              maxLength={500}
              disabled={gerandoIa}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={() => onGerarIa("gerar")} disabled={gerandoIa || !briefIa.trim()}>
                {gerandoIa ? "Gerando..." : "✨ Gerar legenda"}
              </Button>
              {legenda.trim() && (
                <Button type="button" size="sm" variant="outline" onClick={() => onGerarIa("melhorar")} disabled={gerandoIa}>
                  {gerandoIa ? "Gerando..." : "Melhorar rascunho"}
                </Button>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Usa o tom de voz do cliente. Você edita o resultado à vontade.
            </p>
          </div>

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
