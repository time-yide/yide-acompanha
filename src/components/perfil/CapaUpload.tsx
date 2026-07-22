"use client";

import { useState, useTransition, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ImageUp } from "lucide-react";
import { uploadCapaAction } from "@/lib/perfil-jogador/actions";

const MAX_BYTES = 4 * 1024 * 1024;

export function CapaUpload({ userId, currentUrl }: { userId: string; currentUrl: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const ref = useRef<HTMLInputElement>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BYTES) return setError("Máximo 4MB");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return setError("JPEG, PNG ou WebP");
    const local = URL.createObjectURL(file);
    setPreview(local);
    const fd = new FormData();
    fd.set("capa", file);
    startTransition(async () => {
      const r = await uploadCapaAction(userId, fd);
      URL.revokeObjectURL(local);
      if ("error" in r) { setError(r.error); setPreview(currentUrl); return; }
      setPreview(r.capaUrl);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="relative h-28 w-full overflow-hidden rounded-md bg-muted">
        {preview && <Image src={preview} alt="capa" fill className="object-cover" unoptimized />}
      </div>
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onPick} disabled={pending} />
      <Button type="button" variant="outline" size="sm" onClick={() => ref.current?.click()} disabled={pending}>
        <ImageUp className="mr-2 h-4 w-4" />{pending ? "Enviando..." : "Trocar capa"}
      </Button>
      <p className="text-[11px] text-muted-foreground">JPEG, PNG ou WebP. Máximo 4MB.</p>
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
