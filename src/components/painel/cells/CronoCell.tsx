"use client";

import Link from "next/link";
import { Check, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  status: "pendente" | "delegado" | "em_andamento" | "pronto" | "atrasada";
  cronogramaUrl: string | null;
  pacotePost: number | null;
  pacoteVideo: number | null;
  clientId: string;
  clientNome: string;
  mesReferencia: string;
  canEdit: boolean;
}

export function CronoCell({
  status, cronogramaUrl, pacotePost, pacoteVideo, clientId,
}: Props) {
  const hasLink = !!(cronogramaUrl && cronogramaUrl.trim().length > 0);
  const isPronto = status === "pronto" || hasLink;
  const qtd = pacotePost ?? 0;
  const qtdVideos = pacoteVideo ?? 0;

  const partes = [
    qtd > 0 ? `${qtd} arte${qtd > 1 ? "s" : ""}` : null,
    qtdVideos > 0 ? `${qtdVideos} vídeo${qtdVideos > 1 ? "s" : ""}` : null,
  ].filter(Boolean);

  const href = `/social-media/${clientId}?tab=cronograma`;

  return (
    <div className="inline-flex flex-col items-center gap-0.5">
      {isPronto ? (
        <Link
          href={href}
          className="inline-flex h-7 items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 text-[11px] font-medium text-emerald-700 transition-colors hover:bg-emerald-500/20 dark:text-emerald-300"
          title="Ver cronograma"
        >
          <Check className="h-3 w-3" />
          <Calendar className="h-3 w-3" />
        </Link>
      ) : (
        <Link
          href={href}
          className={cn(
            "inline-flex h-7 items-center gap-1 rounded-full border border-border bg-card px-3 text-[10px] font-medium text-muted-foreground transition-colors",
            "hover:bg-muted hover:text-foreground",
          )}
          title="Abrir assistente de cronograma"
        >
          <Calendar className="h-3 w-3" />
          <span>Cronograma</span>
        </Link>
      )}
      {partes.length > 0 && (
        <span className="text-[10px] text-muted-foreground">
          {partes.join(" · ")}
        </span>
      )}
    </div>
  );
}
