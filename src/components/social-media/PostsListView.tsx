"use client";

import { useState, useTransition, useMemo } from "react";
import { Pencil, Archive, ImageIcon } from "lucide-react";
import { PostApprovalButtons } from "./PostApprovalButtons";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  STATUS_DEFS, STATUS_VALORES, REDES, REDE_BY_VALUE, FORMATOS,
} from "@/lib/social-media/tipos";
import {
  archiveSocialPostAction, changeSocialPostStatusAction,
} from "@/lib/social-media/actions";
import type { SocialPostRow } from "@/lib/social-media/queries";

const formatoLabels: Record<string, string> = Object.fromEntries(
  FORMATOS.map((f) => [f.value, f.label]),
);

interface Props {
  posts: SocialPostRow[];
  canManage: boolean;
  onEditPost: (post: SocialPostRow) => void;
}

export function PostsListView({ posts, canManage, onEditPost }: Props) {
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [filtroRede, setFiltroRede] = useState<string>("todos");

  const filtered = useMemo(() => {
    return posts.filter((p) => {
      if (filtroStatus !== "todos" && p.status !== filtroStatus) return false;
      if (filtroRede !== "todos" && !p.redes.includes(filtroRede)) return false;
      return true;
    });
  }, [posts, filtroStatus, filtroRede]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          className="h-8 rounded-md border bg-card px-2 text-xs"
        >
          <option value="todos">Todos status</option>
          {STATUS_VALORES.map((s) => (
            <option key={s} value={s}>{STATUS_DEFS[s].label}</option>
          ))}
        </select>
        <select
          value={filtroRede}
          onChange={(e) => setFiltroRede(e.target.value)}
          className="h-8 rounded-md border bg-card px-2 text-xs"
        >
          <option value="todos">Todas redes</option>
          {REDES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        <span className="text-[11px] text-muted-foreground ml-auto">
          {filtered.length} post{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          <ImageIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
          Nenhum post nesse filtro.
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <PostListItem
              key={p.id}
              post={p}
              canManage={canManage}
              onEdit={() => onEditPost(p)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PostListItem({
  post, canManage, onEdit,
}: {
  post: SocialPostRow;
  canManage: boolean;
  onEdit: () => void;
}) {
  const [pendingArchive, startArchive] = useTransition();
  const [pendingStatus, startStatus] = useTransition();
  const statusDef = STATUS_DEFS[post.status];
  const cover = post.midias[0];
  const isVideo = cover?.match(/\.(mp4|mov|webm)$/i);

  function arquivar() {
    if (!confirm("Arquivar este post?")) return;
    const fd = new FormData();
    fd.set("id", post.id);
    startArchive(async () => {
      await archiveSocialPostAction(fd);
    });
  }

  function mudarStatus(novo: string) {
    const fd = new FormData();
    fd.set("id", post.id);
    fd.set("status", novo);
    startStatus(async () => {
      await changeSocialPostStatusAction(fd);
    });
  }

  return (
    <Card className="p-3 flex flex-wrap items-start gap-3">
      {/* Thumb */}
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border bg-muted/40">
        {cover ? (
          isVideo ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={cover} className="h-full w-full object-cover" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" className="h-full w-full object-cover" />
          )
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <ImageIcon className="h-5 w-5" />
          </div>
        )}
        {post.midias.length > 1 && (
          <span className="absolute bottom-0.5 right-0.5 rounded-full bg-background/90 px-1 text-[8px] font-bold">
            +{post.midias.length - 1}
          </span>
        )}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
            statusDef?.color ?? "",
          )}>
            {statusDef?.label ?? post.status}
          </span>
          {post.redes.map((r) => {
            const def = REDE_BY_VALUE[r];
            if (!def) return null;
            return (
              <Badge
                key={r}
                variant="outline"
                className={cn("text-[10px]", def.color)}
              >
                {def.label}
              </Badge>
            );
          })}
          <Badge variant="secondary" className="text-[10px]">
            {formatoLabels[post.formato] ?? post.formato}
          </Badge>
          {post.agendar_para && (
            <span className="text-[10px] text-muted-foreground">
              📅 {new Date(post.agendar_para).toLocaleString("pt-BR", {
                day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
              })}
            </span>
          )}
        </div>
        {(post.titulo || post.legenda) && (
          <p className="text-xs text-foreground/80 line-clamp-2">
            {post.titulo ? <strong>{post.titulo}</strong> : null}
            {post.titulo && post.legenda ? " · " : ""}
            {post.legenda}
          </p>
        )}
      </div>

      {/* Ações */}
      <div className="flex flex-wrap gap-1 shrink-0">
        {canManage && (
          <PostApprovalButtons
            postId={post.id}
            aprovacaoToken={post.aprovacao_token}
            status={post.status}
            hasMidias={post.midias.length > 0}
            hasRedes={post.redes.length > 0}
          />
        )}
        {canManage && (
          <select
            value={post.status}
            onChange={(e) => mudarStatus(e.target.value)}
            disabled={pendingStatus}
            className="h-7 rounded-md border bg-card px-1 text-[10px]"
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
    </Card>
  );
}
