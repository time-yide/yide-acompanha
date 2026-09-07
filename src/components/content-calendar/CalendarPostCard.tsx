"use client";

import { useState, useRef } from "react";
import {
  Video,
  Image as ImageIcon,
  GalleryHorizontal,
  RefreshCw,
  Pencil,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Calendar as CalendarIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { regeneratePostAction } from "@/lib/content-calendar/actions";
import type { GeneratedPost, CalendarMode } from "@/lib/content-calendar/types";

const TIPO_ICONS = {
  video: Video,
  imagem: ImageIcon,
  carrossel: GalleryHorizontal,
} as const;

const TIPO_LABELS = {
  video: "Vídeo",
  imagem: "Imagem",
  carrossel: "Carrossel",
} as const;

const TIPO_COLORS = {
  video: "text-blue-500 dark:text-blue-400",
  imagem: "text-emerald-500 dark:text-emerald-400",
  carrossel: "text-violet-500 dark:text-violet-400",
} as const;

interface Props {
  post: GeneratedPost;
  index: number;
  calendarId: string;
  modo: CalendarMode;
  onUpdate: (index: number, field: string, value: string) => void;
  readOnly?: boolean;
}

export function CalendarPostCard({
  post,
  index,
  calendarId,
  modo,
  onUpdate,
  readOnly = false,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regenDialogOpen, setRegenDialogOpen] = useState(false);
  const [instrucoes, setInstrucoes] = useState("");
  const [roteiroOpen, setRoteiroOpen] = useState(false);
  const [materialOpen, setMaterialOpen] = useState(false);

  const draftRef = useRef<Record<string, string>>({});

  const Icon = TIPO_ICONS[post.tipo];
  const tipoColor = TIPO_COLORS[post.tipo];

  function startEditing() {
    draftRef.current = {
      tema: post.tema,
      data_sugerida: post.data_sugerida,
      legenda: post.legenda ?? "",
      hashtags: (post.hashtags ?? []).join(" "),
      roteiro: post.roteiro ?? "",
      primeiro_comentario: post.primeiro_comentario ?? "",
    };
    setEditing(true);
  }

  function saveEditing() {
    const d = draftRef.current;
    for (const [field, value] of Object.entries(d)) {
      const original =
        field === "hashtags"
          ? (post.hashtags ?? []).join(" ")
          : ((post as unknown as Record<string, unknown>)[field] as string) ?? "";
      if (value !== original) {
        onUpdate(index, field, value);
      }
    }
    setEditing(false);
  }

  function cancelEditing() {
    draftRef.current = {};
    setEditing(false);
  }

  async function handleRegenerate() {
    setRegenerating(true);
    setRegenDialogOpen(false);
    try {
      const result = await regeneratePostAction(
        calendarId,
        index,
        instrucoes.trim() || undefined,
      );
      if ("error" in result) {
        alert(result.error);
      }
    } finally {
      setRegenerating(false);
      setInstrucoes("");
    }
  }

  return (
    <article className="group relative">
      {/* Post header bar */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span
            className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider ${tipoColor}`}
          >
            <Icon className="h-3.5 w-3.5" />
            {TIPO_LABELS[post.tipo]} #{post.ordem}
          </span>
          <span className="text-muted-foreground/30">·</span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarIcon className="h-3 w-3" />
            {editing ? (
              <Input
                type="date"
                defaultValue={post.data_sugerida}
                onChange={(e) => {
                  draftRef.current.data_sugerida = (
                    e.target as HTMLInputElement
                  ).value;
                }}
                className="h-6 w-[130px] text-xs"
              />
            ) : (
              post.data_sugerida
            )}
          </span>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-1">
            {editing ? (
              <>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={saveEditing}
                  className="text-emerald-600"
                >
                  <Check className="h-3 w-3" />
                  Salvar
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={cancelEditing}
                  className="text-muted-foreground"
                >
                  <X className="h-3 w-3" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={startEditing}
                  className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Pencil className="h-3 w-3" />
                  Editar
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => setRegenDialogOpen(true)}
                  disabled={regenerating}
                  className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <RefreshCw
                    className={`h-3 w-3 ${regenerating ? "animate-spin" : ""}`}
                  />
                  Regenerar
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Regeneration dialog */}
      {regenDialogOpen && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
          <p className="mb-2 text-sm font-medium text-amber-800 dark:text-amber-200">
            O que você quer de diferente neste post?
          </p>
          <Textarea
            autoFocus
            value={instrucoes}
            onChange={(e) =>
              setInstrucoes((e.target as HTMLTextAreaElement).value)
            }
            placeholder="Ex: quero algo mais descontraído, foque em promoção de verão, use referência ao trend X..."
            rows={3}
            className="mb-2 text-sm"
          />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleRegenerate}>
              <RefreshCw className="h-3.5 w-3.5" />
              Regenerar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setRegenDialogOpen(false);
                setInstrucoes("");
              }}
            >
              Cancelar
            </Button>
            <span className="text-xs text-muted-foreground">
              Deixe em branco para regenerar sem instruções
            </span>
          </div>
        </div>
      )}

      {/* Tema */}
      <div className="mb-2">
        {editing ? (
          <Input
            defaultValue={post.tema}
            onChange={(e) => {
              draftRef.current.tema = (e.target as HTMLInputElement).value;
            }}
            className="text-lg font-semibold"
          />
        ) : (
          <span className="text-lg font-semibold text-foreground">
            {post.tema || "Sem título"}
          </span>
        )}
      </div>

      {/* Legenda (modo completo) */}
      {modo === "completo" && (
        <div className="mb-3">
          {editing ? (
            <Textarea
              defaultValue={post.legenda ?? ""}
              onChange={(e) => {
                draftRef.current.legenda = (
                  e.target as HTMLTextAreaElement
                ).value;
              }}
              rows={4}
              className="text-sm"
            />
          ) : (
            <span className="whitespace-pre-wrap leading-relaxed text-foreground/90">
              {post.legenda || "—"}
            </span>
          )}
        </div>
      )}

      {/* Hashtags (modo completo) */}
      {modo === "completo" && (
        <div className="mb-3">
          {editing ? (
            <Input
              defaultValue={(post.hashtags ?? []).join(" ")}
              onChange={(e) => {
                draftRef.current.hashtags = (
                  e.target as HTMLInputElement
                ).value;
              }}
              placeholder="#hashtags separadas por espaço"
              className="text-sm text-primary/70"
            />
          ) : (
            <span className="text-sm text-primary/70">
              {(post.hashtags ?? []).join(" ") || "—"}
            </span>
          )}
        </div>
      )}

      {/* Primeiro comentário (modo completo) */}
      {modo === "completo" && post.primeiro_comentario && !editing && (
        <div className="mb-3">
          <p className="text-xs font-medium text-muted-foreground">
            Primeiro comentário
          </p>
          <p className="text-sm text-foreground/80">
            {post.primeiro_comentario}
          </p>
        </div>
      )}
      {modo === "completo" && editing && (
        <div className="mb-3">
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Primeiro comentário
          </p>
          <Textarea
            defaultValue={post.primeiro_comentario ?? ""}
            onChange={(e) => {
              draftRef.current.primeiro_comentario = (
                e.target as HTMLTextAreaElement
              ).value;
            }}
            rows={2}
            className="text-sm"
          />
        </div>
      )}

      {/* Roteiro — collapsible */}
      {post.tipo === "video" && post.roteiro && (
        <div className="mb-2">
          <button
            type="button"
            onClick={() => setRoteiroOpen(!roteiroOpen)}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {roteiroOpen ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            Roteiro
          </button>
          {roteiroOpen && (
            <div className="mt-1.5 rounded-md border border-dashed border-border/60 bg-muted/30 px-4 py-3">
              {editing ? (
                <Textarea
                  defaultValue={post.roteiro ?? ""}
                  onChange={(e) => {
                    draftRef.current.roteiro = (
                      e.target as HTMLTextAreaElement
                    ).value;
                  }}
                  rows={6}
                  className="text-sm"
                />
              ) : (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
                  {post.roteiro}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Material de estudo — collapsible */}
      {post.material_estudo && (
        <div className="mb-2">
          <button
            type="button"
            onClick={() => setMaterialOpen(!materialOpen)}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {materialOpen ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            Material de estudo
          </button>
          {materialOpen && (
            <div className="mt-1.5 rounded-md border border-dashed border-border/60 bg-muted/30 px-4 py-3">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
                {post.material_estudo}
              </p>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
