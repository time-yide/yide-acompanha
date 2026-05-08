"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { Hash, ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { uploadChannelIconAction, removeChannelIconAction } from "@/lib/escritorio/icon-actions";

interface Props {
  channelId: string;
  nome: string;
  descricao: string | null;
  initialIconUrl: string | null;
}

export function ChannelIconRow({ channelId, nome, descricao, initialIconUrl }: Props) {
  const [iconUrl, setIconUrl] = useState<string | null>(initialIconUrl);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function pickFile() {
    fileInputRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.set("icon", file);
    startTransition(async () => {
      const r = await uploadChannelIconAction(channelId, fd);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setIconUrl(r.iconUrl);
      toast.success("Foto atualizada");
    });
    // reset pra permitir o mesmo arquivo de novo
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleRemove() {
    startTransition(async () => {
      const r = await removeChannelIconAction(channelId);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      setIconUrl(null);
      toast.success("Foto removida");
    });
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
      <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-full border bg-muted">
        {iconUrl ? (
          <Image
            src={iconUrl}
            alt={nome}
            fill
            sizes="48px"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Hash className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{nome}</p>
        {descricao && <p className="truncate text-xs text-muted-foreground">{descricao}</p>}
      </div>

      <div className="flex flex-shrink-0 gap-1.5">
        <Button type="button" variant="outline" size="sm" onClick={pickFile} disabled={pending}>
          <ImagePlus className="mr-1 h-3.5 w-3.5" />
          {iconUrl ? "Trocar" : "Adicionar"}
        </Button>
        {iconUrl && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            disabled={pending}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={onFileChange}
        />
      </div>
    </div>
  );
}
