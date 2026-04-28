"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Bloco visual da senha gerada que aparece UMA única vez para o sócio/ADM
 * copiar e enviar ao colaborador. Usado no fluxo de criação e no reset.
 */
export function RevealedPasswordBlock({
  password,
  hint,
}: {
  password: string;
  hint?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Se a clipboard falhar, o usuário ainda pode copiar manualmente do bloco visível.
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border bg-muted/50 p-3 font-mono text-sm break-all select-all">
        {password}
      </div>
      <Button type="button" variant="secondary" onClick={handleCopy} className="w-full">
        {copied ? "Copiado!" : "Copiar"}
      </Button>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
