"use client";

import { useState } from "react";
import { Link as LinkIcon, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  loginUrl: string;
  /** Tamanho do botão. Default = sm (pra ficar dentro de células de tabela). */
  size?: "sm" | "default";
  /** Texto do botão. Default = "Copiar link". */
  label?: string;
}

/**
 * Copia o link de login do portal do cliente pra área de transferência.
 * Mesma URL pra todos (não há ID por cliente no link), serve só pra a
 * Yasmin não precisar digitar manualmente.
 */
export function CopyLinkButton({ loginUrl, size = "sm", label = "Copiar link" }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(loginUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API pode falhar em contexts inseguros (HTTP) ou Safari restrito.
      // Mostra o link num prompt como fallback.
      window.prompt("Copie o link manualmente:", loginUrl);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      onClick={handleCopy}
      title={loginUrl}
    >
      {copied ? (
        <>
          <Check className="mr-1 h-3 w-3" />
          Copiado!
        </>
      ) : (
        <>
          <LinkIcon className="mr-1 h-3 w-3" />
          {label}
        </>
      )}
    </Button>
  );
}
