"use client";

import { useState, useTransition, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { uploadAvatarAction } from "@/lib/colaboradores/avatar-actions";

const MAX_BYTES = 2 * 1024 * 1024;

interface Props {
  userId: string;
  nome: string;
  currentUrl: string | null;
}

function initials(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function AvatarUpload({ userId, nome, currentUrl }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_BYTES) {
      setError("Máximo 2MB");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Apenas JPEG, PNG ou WebP");
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);

    const fd = new FormData();
    fd.set("avatar", file);

    startTransition(async () => {
      const result = await uploadAvatarAction(userId, fd);
      URL.revokeObjectURL(localPreview);
      if ("error" in result) {
        setError(result.error);
        setPreviewUrl(currentUrl);
        return;
      }
      setPreviewUrl(result.avatarUrl);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-4">
      {previewUrl ? (
        <Image
          src={previewUrl}
          alt={nome}
          width={96}
          height={96}
          className="h-24 w-24 rounded-full object-cover"
          unoptimized
        />
      ) : (
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted text-2xl font-semibold text-muted-foreground">
          {initials(nome)}
        </div>
      )}
      <div className="space-y-1">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={onPick}
          disabled={pending}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={pending}
        >
          <Upload className="mr-2 h-4 w-4" />
          {pending ? "Enviando..." : "Trocar foto"}
        </Button>
        <p className="text-[11px] text-muted-foreground">JPEG, PNG ou WebP. Máximo 2MB.</p>
        {error && <p className="text-[11px] text-destructive">{error}</p>}
      </div>
    </div>
  );
}
