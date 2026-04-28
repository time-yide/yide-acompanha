"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { setSatisfactionCommentAction } from "@/lib/satisfacao/actions";
import { MessageSquarePlus, Check } from "lucide-react";

interface Props {
  clientId: string;
  initialComentario: string | null;
}

export function CommentBox({ clientId, initialComentario }: Props) {
  const [open, setOpen] = useState(Boolean(initialComentario && initialComentario.length > 0));
  const [value, setValue] = useState(initialComentario ?? "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function persist(next: string) {
    const fd = new FormData();
    fd.set("client_id", clientId);
    fd.set("comentario", next);
    startTransition(async () => {
      await setSatisfactionCommentAction(fd);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  function onChange(next: string) {
    setValue(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => persist(next), 1500);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        <MessageSquarePlus className="h-3.5 w-3.5" />
        comentário
      </button>
    );
  }

  return (
    <div className="flex-1 max-w-md">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          persist(value);
        }}
        placeholder="Comentário (opcional)"
        rows={2}
        className="text-sm"
      />
      <div className="mt-1 flex items-center justify-end gap-2 text-[11px] text-muted-foreground">
        {pending && <span>Salvando...</span>}
        {saved && (
          <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
            <Check className="h-3 w-3" /> Salvo
          </span>
        )}
      </div>
    </div>
  );
}
