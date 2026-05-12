"use client";

import { useState, useTransition } from "react";
import { Upload, X } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  createSocialPostAction, updateSocialPostAction, uploadSocialMidiaAction,
} from "@/lib/social-media/actions";
import { REDES, FORMATOS, STATUS_DEFS } from "@/lib/social-media/tipos";
import type { SocialPostRow } from "@/lib/social-media/queries";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string;
  post?: SocialPostRow | null;
  /** Pré-preenche data ao criar (do click no calendário). */
  defaultDate?: string;
}

/** Converte ISO UTC → string pra <input type=datetime-local>. */
function isoToDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  // Subtrai timezone offset pra ficar no horário local que o input espera
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

/** Converte string do <input type=datetime-local> → ISO UTC. */
function datetimeLocalToIso(value: string): string | null {
  if (!value) return null;
  const local = new Date(value);
  if (isNaN(local.getTime())) return null;
  return local.toISOString();
}

export function PostFormModal({ open, onOpenChange, clientId, post, defaultDate }: Props) {
  const isEdit = !!post;
  const [formato, setFormato] = useState<string>(post?.formato ?? "feed");
  const [status, setStatus] = useState<string>(post?.status ?? "rascunho");
  const [redes, setRedes] = useState<string[]>(post?.redes ?? ["instagram"]);
  const [midias, setMidias] = useState<string[]>(post?.midias ?? []);
  const [agendar, setAgendar] = useState<string>(
    isoToDatetimeLocal(post?.agendar_para) || (defaultDate ? `${defaultDate}T10:00` : ""),
  );
  const [pending, startTransition] = useTransition();
  const [uploading, startUpload] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggleRede(value: string) {
    setRedes((prev) => prev.includes(value) ? prev.filter((r) => r !== value) : [...prev, value]);
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    e.target.value = "";

    startUpload(async () => {
      for (const file of files) {
        const fd = new FormData();
        fd.set("file", file);
        const r = await uploadSocialMidiaAction(clientId, fd);
        if ("error" in r) {
          setError(r.error);
          break;
        }
        setMidias((prev) => [...prev, r.url]);
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
                placeholder="Ex.: BlackFriday — Slide 1"
                maxLength={200}
              />
              <p className="text-[10px] text-muted-foreground">Só pra você organizar — não vai aparecer no post.</p>
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

          {/* Legenda */}
          <div className="space-y-1.5">
            <Label htmlFor="legenda">Legenda</Label>
            <Textarea
              id="legenda"
              name="legenda"
              rows={5}
              defaultValue={post?.legenda ?? ""}
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
                defaultValue={post?.hashtags ?? ""}
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
