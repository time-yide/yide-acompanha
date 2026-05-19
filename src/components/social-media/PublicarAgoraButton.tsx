"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { publishSocialPostAction } from "@/lib/social-media/publish-actions";

interface Props {
  postId: string;
  /** Quando "agendado" muda label pra "Publicar agora" (override do schedule). */
  status: string;
}

/**
 * Dispara publicação imediata no Meta (IG/FB). Usa o token System User
 * da BM Yide (META_SYSTEM_USER_TOKEN).
 *
 * Confirmação obrigatória — publicação real, sem desfazer.
 */
export function PublicarAgoraButton({ postId, status }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function publish() {
    const fd = new FormData();
    fd.set("id", postId);
    fd.set("forceNow", "true");
    startTransition(async () => {
      const r = await publishSocialPostAction(fd);
      if (r.error) {
        toast.error(r.error);
        setConfirming(false);
        return;
      }
      toast.success("Post publicado!");
      setConfirming(false);
      router.refresh();
    });
  }

  if (status === "publicado") return null;

  if (confirming) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-2.5">
        <span className="text-xs text-amber-700 dark:text-amber-300">
          Tem certeza? Publicação é imediata e não pode ser desfeita.
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setConfirming(false)}
          disabled={pending}
        >
          Cancelar
        </Button>
        <Button size="sm" onClick={publish} disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Publicando...
            </>
          ) : (
            <>
              <Send className="mr-1.5 h-3.5 w-3.5" />
              Sim, publicar
            </>
          )}
        </Button>
      </div>
    );
  }

  const label = status === "agendado" ? "Publicar agora" : "Publicar";
  return (
    <Button size="sm" onClick={() => setConfirming(true)}>
      <Send className="mr-1.5 h-3.5 w-3.5" />
      {label}
    </Button>
  );
}
