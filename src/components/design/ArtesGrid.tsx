"use client";

import { useState, useTransition } from "react";
import {
  Pencil, Archive, Plus, Sparkles, Download,
  ImageIcon as ImageLucide, Calendar as CalendarIcon, MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArteFormModal } from "./ArteFormModal";
import { IaPlaceholderModal } from "./IaPlaceholderModal";
import { archiveArteAction, changeArteStatusAction } from "@/lib/design/actions";
import { STATUS_DEFS, FORMATOS, STATUS_VALORES } from "@/lib/design/tipos";
import type { ArteRow } from "@/lib/design/queries";

const formatoLabels: Record<string, string> = Object.fromEntries(
  FORMATOS.map((f) => [f.value, f.label]),
);

interface Props {
  clientId: string;
  artes: ArteRow[];
  canManage: boolean;
}

export function ArtesGrid({ clientId, artes, canManage }: Props) {
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<ArteRow | null>(null);
  const [openIa, setOpenIa] = useState(false);

  function novaArte() {
    setEditing(null);
    setOpenForm(true);
  }

  function editarArte(a: ArteRow) {
    setEditing(a);
    setOpenForm(true);
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div className="flex flex-wrap gap-2">
          {canManage && (
            <Button size="sm" onClick={novaArte}>
              <Plus className="h-4 w-4" /> Nova arte
            </Button>
          )}
          {canManage && (
            <Button size="sm" variant="outline" onClick={() => setOpenIa(true)}>
              <Sparkles className="h-4 w-4" /> Gerar com IA
              <span className="ml-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 text-[9px] text-amber-700 dark:text-amber-300">
                em breve
              </span>
            </Button>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {artes.length} arte{artes.length === 1 ? "" : "s"}
        </div>
      </div>

      {artes.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          <ImageLucide className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
          Nenhuma arte cadastrada ainda. {canManage && "Clica em \"Nova arte\" pra começar."}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {artes.map((arte) => (
            <ArteCard
              key={arte.id}
              arte={arte}
              canManage={canManage}
              onEdit={() => editarArte(arte)}
            />
          ))}
        </div>
      )}

      {openForm && (
        <ArteFormModal
          open={openForm}
          onOpenChange={setOpenForm}
          clientId={clientId}
          arte={editing}
          onIaClick={() => {
            setOpenForm(false);
            setOpenIa(true);
          }}
        />
      )}
      {openIa && (
        <IaPlaceholderModal open={openIa} onOpenChange={setOpenIa} />
      )}
    </>
  );
}

function ArteCard({
  arte, canManage, onEdit,
}: {
  arte: ArteRow;
  canManage: boolean;
  onEdit: () => void;
}) {
  const [pendingArchive, startArchive] = useTransition();
  const [pendingStatus, startStatus] = useTransition();
  const statusDef = STATUS_DEFS[arte.status];

  const cover = arte.midias[0];
  const hasMore = arte.midias.length > 1;
  const isVideo = cover?.match(/\.(mp4|mov|webm)$/i);

  function arquivar() {
    if (!confirm(`Arquivar a arte "${arte.titulo}"?`)) return;
    const fd = new FormData();
    fd.set("id", arte.id);
    startArchive(async () => {
      await archiveArteAction(fd);
    });
  }

  function mudarStatus(novo: string) {
    const fd = new FormData();
    fd.set("id", arte.id);
    fd.set("status", novo);
    startStatus(async () => {
      await changeArteStatusAction(fd);
    });
  }

  return (
    <Card className="overflow-hidden flex flex-col">
      {/* Preview */}
      <div className="relative aspect-square bg-muted/40">
        {cover ? (
          isVideo ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={cover} className="h-full w-full object-cover" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt={arte.titulo} className="h-full w-full object-cover" />
          )
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <ImageLucide className="h-8 w-8" />
          </div>
        )}
        {hasMore && (
          <span className="absolute bottom-2 right-2 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-semibold">
            +{arte.midias.length - 1}
          </span>
        )}
        <span
          className={`absolute top-2 left-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium backdrop-blur-sm ${statusDef?.color ?? ""}`}
        >
          {statusDef?.label ?? arte.status}
        </span>
        {arte.fonte_origem !== "manual" && (
          <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-primary/90 px-2 py-0.5 text-[10px] font-medium text-white">
            <Sparkles className="h-2.5 w-2.5" /> IA
          </span>
        )}
      </div>

      {/* Conteúdo */}
      <div className="p-3 space-y-2 flex-1 flex flex-col">
        <div className="space-y-1">
          <h3 className="font-semibold text-sm leading-tight truncate" title={arte.titulo}>
            {arte.titulo}
          </h3>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Badge variant="secondary" className="text-[10px]">
              {formatoLabels[arte.formato] ?? arte.formato}
            </Badge>
            <span>·</span>
            <span>{new Date(arte.created_at).toLocaleDateString("pt-BR")}</span>
          </div>
        </div>

        {arte.copy && (
          <p className="text-[11px] text-muted-foreground line-clamp-2" title={arte.copy}>
            <MessageSquare className="inline h-3 w-3 mr-0.5" /> {arte.copy}
          </p>
        )}

        {arte.agendado_para && (
          <p className="text-[10px] text-violet-600 dark:text-violet-400">
            <CalendarIcon className="inline h-3 w-3 mr-0.5" />
            Agendado: {new Date(arte.agendado_para).toLocaleString("pt-BR")}
          </p>
        )}

        {arte.ajuste_observacoes && arte.status === "ajustes_solicitados" && (
          <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-2">
            <p className="text-[10px] font-semibold text-rose-700 dark:text-rose-300">
              Cliente pediu ajustes:
            </p>
            <p className="text-[10px] text-foreground/80 mt-0.5">{arte.ajuste_observacoes}</p>
          </div>
        )}

        {/* Ações */}
        <div className="mt-auto flex flex-wrap gap-1 pt-2 border-t">
          {cover && (
            <a
              href={cover}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-7 items-center gap-1 rounded-md border bg-card px-2 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Baixar mídia"
            >
              <Download className="h-3 w-3" /> Baixar
            </a>
          )}
          {canManage && (
            <select
              value={arte.status}
              onChange={(e) => mudarStatus(e.target.value)}
              disabled={pendingStatus}
              className="h-7 flex-1 min-w-0 rounded-md border bg-card px-1 text-[10px]"
            >
              {STATUS_VALORES.map((s) => (
                <option key={s} value={s}>{STATUS_DEFS[s].label}</option>
              ))}
            </select>
          )}
          {canManage && (
            <>
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border bg-card text-muted-foreground hover:bg-muted"
                title="Editar"
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={arquivar}
                disabled={pendingArchive}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border bg-card text-muted-foreground hover:bg-muted disabled:opacity-50"
                title="Arquivar"
              >
                <Archive className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
