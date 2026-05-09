"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Film,
  ImageIcon,
  Star,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { avgRating, type CapturaRow } from "@/lib/audiovisual/captura-utils";
import { DelegarCapturaButton } from "./DelegarCapturaButton";

interface Editor {
  id: string;
  nome: string;
}

interface Props {
  capturas: CapturaRow[];
  showVideomaker?: boolean;
  editores?: Editor[];
  canDelegate?: boolean;
}

function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR");
}

interface CapturaCardProps {
  captura: CapturaRow;
  showVideomaker: boolean;
  editores: Editor[];
  canDelegate: boolean;
}

function CapturaCard({ captura: c, showVideomaker, editores, canDelegate }: CapturaCardProps) {
  const media = avgRating(c);
  const hasNotes = Boolean(
    c.pontos_positivos || c.pontos_dificuldade || c.sugestoes || c.observacoes,
  );
  const [showDetails, setShowDetails] = useState(false);

  return (
    <Card className="overflow-hidden p-0">
      {/* Conteúdo */}
      <div className="space-y-2.5 px-4 py-3">
        {/* Linha 1: cliente + rating */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold leading-tight">
              {c.cliente?.nome ?? "—"}
            </h3>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {formatDateBR(c.data_captacao)}
              {showVideomaker && c.videomaker?.nome && (
                <> · {c.videomaker.nome}</>
              )}
            </p>
          </div>
          {media !== null && (
            <div className="flex flex-shrink-0 items-center gap-1 text-xs">
              <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
              <span className="font-semibold tabular-nums">{media.toFixed(1)}</span>
              <span className="text-muted-foreground">/5</span>
            </div>
          )}
        </div>

        {/* Linha 2: stats inline (ícones lucide ao invés de emoji) */}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Film className="h-3 w-3" />
            <span className="tabular-nums">{c.qtd_videos}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <ImageIcon className="h-3 w-3" />
            <span className="tabular-nums">{c.qtd_fotos}</span>
          </span>
          {c.drive_url && (
            <Link
              href={c.drive_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Drive
            </Link>
          )}
        </div>

        {/* Linha 3: notes colapsáveis (só renderiza toggle se tem conteúdo) */}
        {hasNotes && (
          <div>
            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              {showDetails ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              {showDetails ? "Ocultar detalhes" : "Ver detalhes"}
            </button>

            {showDetails && (
              <div className="mt-2 space-y-1.5 rounded-md border border-border/40 bg-muted/30 p-2.5 text-xs">
                {c.pontos_positivos && (
                  <p>
                    <span className="font-medium text-emerald-700 dark:text-emerald-400">
                      Pontos positivos:
                    </span>{" "}
                    <span className="text-muted-foreground">{c.pontos_positivos}</span>
                  </p>
                )}
                {c.pontos_dificuldade && (
                  <p>
                    <span className="font-medium text-amber-700 dark:text-amber-400">
                      Dificuldades:
                    </span>{" "}
                    <span className="text-muted-foreground">{c.pontos_dificuldade}</span>
                  </p>
                )}
                {c.sugestoes && (
                  <p>
                    <span className="font-medium text-sky-700 dark:text-sky-400">
                      Sugestões:
                    </span>{" "}
                    <span className="text-muted-foreground">{c.sugestoes}</span>
                  </p>
                )}
                {c.observacoes && (
                  <p className="italic text-muted-foreground">{c.observacoes}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer: status + ações com fundo sutil pra separar do conteúdo */}
      <div className="border-t border-border/50 bg-muted/20 px-4 py-2">
        <DelegarCapturaButton
          capturaId={c.id}
          delegated={
            c.task_id && c.task
              ? { taskId: c.task.id, editorNome: c.task.editor_nome }
              : null
          }
          concluidaEm={c.concluida_em}
          editores={editores}
          canDelegate={canDelegate}
        />
      </div>
    </Card>
  );
}

export function CapturasList({
  capturas,
  showVideomaker = false,
  editores = [],
  canDelegate = false,
}: Props) {
  if (capturas.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-sm italic text-muted-foreground">
          Nenhuma captação registrada ainda.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {capturas.map((c) => (
        <CapturaCard
          key={c.id}
          captura={c}
          showVideomaker={showVideomaker}
          editores={editores}
          canDelegate={canDelegate}
        />
      ))}
    </div>
  );
}
