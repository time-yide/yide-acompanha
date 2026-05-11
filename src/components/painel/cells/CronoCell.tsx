"use client";

import Link from "next/link";
import { Check, ExternalLink, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  /** UUID do step de cronograma — não é mais usado pra clicar, mas mantém compat. */
  stepId: string | null;
  /** Status calculado (já considera derivação por link_estrategia). */
  status: "pendente" | "delegado" | "em_andamento" | "pronto" | "atrasada";
  /** URL do documento de estratégia (Drive, Gamma, etc.). Quando presente, célula
   *  fica verde e clicar abre o link em outra aba. */
  linkEstrategia: string | null;
  /** ID do cliente — usado pra navegar pra página do cliente quando não tem link ainda. */
  clientId: string;
}

/**
 * Célula de Cronograma:
 *  - Sem link de estratégia: aparece como "Pendente", clicar leva pra /clientes/[id]/editar
 *    onde o usuário cola o link (Drive, Gamma, etc.).
 *  - Com link: fica verde, clicar abre o link em outra aba.
 *
 *  O status "pronto" é derivado automaticamente em queries.ts a partir do
 *  client.link_estrategia — não depende mais do markStepProntoAction.
 */
export function CronoCell({ stepId, status, linkEstrategia, clientId }: Props) {
  if (!stepId) return <span className="text-[11px] text-muted-foreground/60">—</span>;

  const hasLink = !!(linkEstrategia && linkEstrategia.trim().length > 0);
  // Pronto pode vir do banco (manual) OU do auto-derive (link preenchido).
  const isPronto = status === "pronto" || hasLink;

  if (isPronto && hasLink) {
    return (
      <a
        href={linkEstrategia!}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-7 items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 text-[11px] font-medium text-emerald-700 transition-colors hover:bg-emerald-500/20 dark:text-emerald-300"
        title="Abrir estratégia"
      >
        <Check className="h-3 w-3" />
        <ExternalLink className="h-3 w-3" />
      </a>
    );
  }

  if (isPronto) {
    // Status pronto vindo do banco mas sem link cadastrado — mostra check neutro.
    return (
      <span
        className="inline-flex h-7 items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 text-[11px] font-medium text-emerald-700 dark:text-emerald-300"
        title="Marcado como pronto"
      >
        <Check className="h-3 w-3" />
      </span>
    );
  }

  return (
    <Link
      href={`/clientes/${clientId}/editar`}
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-full border border-border bg-card px-3 text-[10px] font-medium text-muted-foreground transition-colors",
        "cursor-pointer hover:bg-muted hover:text-foreground",
      )}
      title="Adicionar link da estratégia (Drive, Gamma, etc.)"
    >
      <FileText className="h-3 w-3" />
      <span>Add link</span>
    </Link>
  );
}
