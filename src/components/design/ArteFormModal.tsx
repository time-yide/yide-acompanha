"use client";

import { useState, useTransition } from "react";
import { Upload, X, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  createArteAction, updateArteAction, uploadDesignMidiaAction,
} from "@/lib/design/actions";
import { FORMATOS, STATUS_DEFS, IA_PROVIDERS } from "@/lib/design/tipos";
import type { ArteRow } from "@/lib/design/queries";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string;
  arte?: ArteRow | null;
  onIaClick?: () => void;
}

export function ArteFormModal({ open, onOpenChange, clientId, arte, onIaClick }: Props) {
  const isEdit = !!arte;
  const [formato, setFormato] = useState<string>(arte?.formato ?? "feed");
  const [status, setStatus] = useState<string>(arte?.status ?? "rascunho");
  const [midias, setMidias] = useState<string[]>(arte?.midias ?? []);
  const [pending, startTransition] = useTransition();
  const [uploading, startUpload] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    e.target.value = "";

    startUpload(async () => {
      for (const file of files) {
        const fd = new FormData();
        fd.set("file", file);
        const r = await uploadDesignMidiaAction(clientId, fd);
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
    fd.set("midias", JSON.stringify(midias));
    if (isEdit && arte) fd.set("id", arte.id);

    startTransition(async () => {
      const r = isEdit ? await updateArteAction(fd) : await createArteAction(fd);
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
            <DialogTitle>{isEdit ? "Editar arte" : "Nova arte"}</DialogTitle>
          </DialogHeader>

          {!isEdit && onIaClick && (
            <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
              <div className="flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Quer gerar com IA?</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Disponível na próxima fase. {IA_PROVIDERS.length} provedores planejados (GPT-Image-1, Imagen, Flux, Ideogram).
                  </p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={onIaClick}>
                  Ver opções IA
                </Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="titulo">Título *</Label>
              <Input
                id="titulo"
                name="titulo"
                defaultValue={arte?.titulo ?? ""}
                required
                minLength={2}
                maxLength={200}
                placeholder="Ex.: Carrossel Black Friday Slide 1"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="formato">Formato</Label>
              <Select value={formato} onValueChange={(v) => setFormato(v ?? "feed")}>
                <SelectTrigger id="formato"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORMATOS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
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
          </div>

          {/* Mídias */}
          <div className="space-y-2">
            <Label>Mídias (imagens / vídeos)</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {midias.map((url, i) => (
                <div key={i} className="relative aspect-square overflow-hidden rounded-md border bg-muted/40">
                  {url.match(/\.(mp4|mov|webm)$/i) ? (
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
              <label
                className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-muted-foreground/30 bg-muted/20 text-[10px] text-muted-foreground hover:bg-muted/40"
              >
                {uploading ? (
                  <span>Enviando...</span>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    <span>Enviar</span>
                  </>
                )}
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={onUpload}
                  disabled={uploading}
                />
              </label>
            </div>
            <p className="text-[10px] text-muted-foreground">
              JPG, PNG, WebP, GIF, MP4, MOV. Máx 25MB por arquivo.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              name="descricao"
              rows={2}
              defaultValue={arte?.descricao ?? ""}
              placeholder="Notas internas sobre essa arte"
              maxLength={2000}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="copy">Copy / Legenda do post</Label>
            <Textarea
              id="copy"
              name="copy"
              rows={4}
              defaultValue={arte?.copy ?? ""}
              placeholder="Texto que vai junto com o post quando publicar..."
              maxLength={4000}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="hashtags">Hashtags</Label>
            <Input
              id="hashtags"
              name="hashtags"
              defaultValue={arte?.hashtags ?? ""}
              placeholder="#blackfriday #design #marketing"
              maxLength={2000}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              name="observacoes"
              rows={2}
              defaultValue={arte?.observacoes ?? ""}
              maxLength={2000}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending || uploading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || uploading}>
              {pending ? "Salvando..." : isEdit ? "Salvar alterações" : "Criar arte"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
