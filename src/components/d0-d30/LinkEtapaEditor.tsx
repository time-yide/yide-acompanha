"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { salvarLinkEtapaAction } from "@/lib/d0-d30/actions";

interface Props {
  etapaId: string;
  initialValue: string | null;
  /** Label customizado por etapa — ex: "Link da estratégia" pra etapa de tráfego. */
  label: string;
  placeholder?: string;
}

export function LinkEtapaEditor({ etapaId, initialValue, label, placeholder }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue ?? "");
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const initialNormalized = initialValue ?? "";
  const isDirty = value !== initialNormalized;

  function handleSave() {
    if (!isDirty || pending) return;
    setError(null);
    const fd = new FormData();
    fd.set("etapa_id", etapaId);
    fd.set("link_etapa", value);
    startTransition(async () => {
      const res = await salvarLinkEtapaAction(fd);
      if (res && "error" in res) {
        setError(res.error);
        return;
      }
      setSavedAt(Date.now());
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </h3>
        {savedAt && !isDirty && (
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
            ✓ Salvo
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="url"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder ?? "https://..."}
          maxLength={500}
          className="block w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        {initialNormalized && !isDirty && (
          <a
            href={initialNormalized}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1 rounded-md border bg-card px-3 text-xs font-medium hover:bg-muted"
            title="Abrir em nova aba"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Abrir
          </a>
        )}
      </div>
      {error && (
        <p className="mt-1.5 text-xs text-destructive">{error}</p>
      )}
      {isDirty && (
        <div className="mt-2 flex justify-end">
          <Button size="sm" onClick={handleSave} disabled={pending}>
            {pending ? "Salvando..." : "Salvar link"}
          </Button>
        </div>
      )}
    </div>
  );
}
