"use client";

import { useState, useTransition } from "react";
import { Send, Copy, Check, Loader2 } from "lucide-react";
import { sendArteForApprovalAction } from "@/lib/design/approval-actions";

interface Props {
  arteId: string;
  aprovacaoToken: string | null;
  status: string;
  hasMidias: boolean;
}

/**
 * Botões compactos pra ações de aprovação:
 *  - "Enviar pra cliente" → muda status pra aguardando_aprovacao
 *  - "Copiar link" → copia URL pública pra clipboard
 */
export function ApprovalLinkButtons({ arteId, aprovacaoToken, status, hasMidias }: Props) {
  const [pending, startSend] = useTransition();
  const [copied, setCopied] = useState(false);

  const url = aprovacaoToken && typeof window !== "undefined"
    ? `${window.location.origin}/aprovacao-design/${aprovacaoToken}`
    : null;

  function send() {
    if (!hasMidias) {
      alert("Adicione ao menos uma mídia antes de enviar pra aprovação");
      return;
    }
    const fd = new FormData();
    fd.set("id", arteId);
    startSend(async () => {
      const r = await sendArteForApprovalAction(fd);
      if ("error" in r) {
        alert(r.error);
        return;
      }
      if (url) {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 3000);
        } catch {
          // ignore
        }
      }
    });
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: prompt
      window.prompt("Copia esse link:", url);
    }
  }

  // Se ainda nem foi enviado pra aprovação, mostra "Enviar"
  if (status === "rascunho" || status === "em_producao") {
    return (
      <button
        type="button"
        onClick={send}
        disabled={pending || !hasMidias}
        className="inline-flex h-7 items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 text-[10px] font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 disabled:opacity-50"
        title={!hasMidias ? "Adicione mídias antes de enviar" : "Enviar pra cliente aprovar"}
      >
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
        {pending ? "Enviando..." : "Enviar pra cliente"}
      </button>
    );
  }

  // Se está aguardando ou já foi aprovado/recusado, mostra "Copiar link"
  if (url) {
    return (
      <button
        type="button"
        onClick={copy}
        className="inline-flex h-7 items-center gap-1 rounded-md border bg-card px-2 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
        title="Copiar link de aprovação do cliente"
      >
        {copied ? (
          <>
            <Check className="h-3 w-3 text-emerald-600" />
            Copiado
          </>
        ) : (
          <>
            <Copy className="h-3 w-3" />
            Link cliente
          </>
        )}
      </button>
    );
  }

  return null;
}
