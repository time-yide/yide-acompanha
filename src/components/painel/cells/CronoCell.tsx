"use client";

import { useState } from "react";
import { Check, ExternalLink, FileText } from "lucide-react";
import { CronogramaModal } from "../modals/CronogramaModal";
import { cn } from "@/lib/utils";

interface Props {
  /** Status calculado (já considera derivação por cronograma_url/link_estrategia). */
  status: "pendente" | "delegado" | "em_andamento" | "pronto" | "atrasada";
  /** URL do cronograma do mês (client_monthly_checklist.cronograma_url) ou, como
   *  fallback pra clientes antigos, o link_estrategia do cliente. */
  cronogramaUrl: string | null;
  /** Quantidade de artes/posts (pacote_post) — exibida no sub-rótulo. */
  pacotePost: number | null;
  /** Quantidade de vídeos (pacote_video) — exibida no sub-rótulo. */
  pacoteVideo: number | null;
  /** ID do cliente. */
  clientId: string;
  clientNome: string;
  mesReferencia: string;
  canEdit: boolean;
}

/**
 * Célula de Cronograma (mensal):
 *  - Sem link: "Add link" abre o CronogramaModal (link do drive + quantidade).
 *    Ao salvar, cria a tarefa de design automaticamente.
 *  - Com link: fica verde, clicar abre o link em outra aba (editar via modal
 *    ainda disponível pra quem pode editar, clicando no rótulo de posts).
 */
export function CronoCell({
  status, cronogramaUrl, pacotePost, pacoteVideo, clientId, clientNome, mesReferencia, canEdit,
}: Props) {
  const [open, setOpen] = useState(false);
  const hasLink = !!(cronogramaUrl && cronogramaUrl.trim().length > 0);
  const isPronto = status === "pronto" || hasLink;
  const qtd = pacotePost ?? 0;
  const qtdVideos = pacoteVideo ?? 0;

  const partes = [
    qtd > 0 ? `${qtd} arte${qtd > 1 ? "s" : ""}` : null,
    qtdVideos > 0 ? `${qtdVideos} vídeo${qtdVideos > 1 ? "s" : ""}` : null,
  ].filter(Boolean);

  const temLabel = partes.length > 0;
  // Mostra o rótulo (que abre o modal de editar/excluir) quando há quantidades OU,
  // pra quem pode editar, sempre que já existe cronograma — assim ajustar/excluir
  // fica acessível mesmo sem quantidades preenchidas.
  const postsLabel = temLabel || (canEdit && hasLink) ? (
    <button
      type="button"
      onClick={() => canEdit && setOpen(true)}
      disabled={!canEdit}
      className={cn(
        "text-[10px] text-muted-foreground",
        canEdit && "hover:text-foreground hover:underline",
      )}
    >
      {temLabel ? partes.join(" · ") : "editar"}
    </button>
  ) : null;

  return (
    <>
      <div className="inline-flex flex-col items-center gap-0.5">
        {isPronto && hasLink ? (
          <a
            href={cronogramaUrl!}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-7 items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 text-[11px] font-medium text-emerald-700 transition-colors hover:bg-emerald-500/20 dark:text-emerald-300"
            title="Abrir cronograma"
          >
            <Check className="h-3 w-3" />
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : isPronto ? (
          <span
            className="inline-flex h-7 items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 text-[11px] font-medium text-emerald-700 dark:text-emerald-300"
            title="Marcado como pronto"
          >
            <Check className="h-3 w-3" />
          </span>
        ) : (
          <button
            type="button"
            onClick={() => canEdit && setOpen(true)}
            disabled={!canEdit}
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded-full border border-border bg-card px-3 text-[10px] font-medium text-muted-foreground transition-colors",
              canEdit ? "cursor-pointer hover:bg-muted hover:text-foreground" : "cursor-default opacity-60",
            )}
            title="Subir cronograma (link + quantidade)"
          >
            <FileText className="h-3 w-3" />
            <span>Add link</span>
          </button>
        )}
        {postsLabel}
      </div>

      {canEdit && (
        <CronogramaModal
          open={open}
          onOpenChange={setOpen}
          clientId={clientId}
          clientNome={clientNome}
          mesReferencia={mesReferencia}
          initialUrl={cronogramaUrl}
          initialQuantidade={qtd}
          initialVideos={qtdVideos}
        />
      )}
    </>
  );
}
