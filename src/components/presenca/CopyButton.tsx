"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, Check } from "lucide-react";

/** Copia um texto pro clipboard e mostra um toast. */
export function CopyButton({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      toast.success("Copiado!");
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      toast.error("Não consegui copiar. Copie manualmente.");
    }
  }
  return (
    <button
      type="button"
      onClick={copiar}
      className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
    >
      {copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copiado ? "Copiado" : "Copiar"}
    </button>
  );
}
