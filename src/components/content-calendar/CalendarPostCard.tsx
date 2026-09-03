"use client";

import { useState } from "react";
import {
  Video,
  Image as ImageIcon,
  GalleryHorizontal,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  video: "Video",
  imagem: "Imagem",
  carrossel: "Carrossel",
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
  const [regenerating, setRegenerating] = useState(false);
  const [roteiroOpen, setRoteiroOpen] = useState(false);
  const [materialOpen, setMaterialOpen] = useState(false);

  const Icon = TIPO_ICONS[post.tipo];

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      const result = await regeneratePostAction(calendarId, index);
      if ("error" in result) {
        alert(result.error);
      }
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      {/* Header: badge + regenerar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Icon className="h-3 w-3" />
            {TIPO_LABELS[post.tipo]} #{post.ordem}
          </Badge>
        </div>
        {!readOnly && (
          <Button
            size="xs"
            variant="ghost"
            onClick={handleRegenerate}
            disabled={regenerating}
          >
            <RefreshCw
              className={`h-3 w-3 ${regenerating ? "animate-spin" : ""}`}
            />
            Regenerar
          </Button>
        )}
      </div>

      {/* Data sugerida */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">
          Data sugerida
        </label>
        {readOnly ? (
          <p className="text-sm">{post.data_sugerida}</p>
        ) : (
          <Input
            type="date"
            value={post.data_sugerida}
            onChange={(e) => {
              const target = e.target as HTMLInputElement;
              onUpdate(index, "data_sugerida", target.value);
            }}
            className="h-8 text-sm"
          />
        )}
      </div>

      {/* Tema */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">
          Tema
        </label>
        {readOnly ? (
          <p className="text-sm">{post.tema}</p>
        ) : (
          <Input
            value={post.tema}
            onChange={(e) => {
              const target = e.target as HTMLInputElement;
              onUpdate(index, "tema", target.value);
            }}
            className="h-8 text-sm"
          />
        )}
      </div>

      {/* Legenda (modo completo apenas) */}
      {modo === "completo" && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Legenda
          </label>
          {readOnly ? (
            <p className="text-sm whitespace-pre-wrap">
              {post.legenda || "—"}
            </p>
          ) : (
            <Textarea
              value={post.legenda ?? ""}
              onChange={(e) => {
                const target = e.target as HTMLTextAreaElement;
                onUpdate(index, "legenda", target.value);
              }}
              rows={3}
              className="text-sm"
            />
          )}
        </div>
      )}

      {/* Hashtags (modo completo apenas) */}
      {modo === "completo" && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Hashtags
          </label>
          {readOnly ? (
            <p className="text-sm text-muted-foreground">
              {(post.hashtags ?? []).join(" ") || "—"}
            </p>
          ) : (
            <Input
              value={(post.hashtags ?? []).join(" ")}
              onChange={(e) => {
                const target = e.target as HTMLInputElement;
                onUpdate(index, "hashtags", target.value);
              }}
              placeholder="#hashtag1 #hashtag2"
              className="h-8 text-sm"
            />
          )}
        </div>
      )}

      {/* Roteiro (tipo=video, collapsible) */}
      {post.tipo === "video" && post.roteiro && (
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => setRoteiroOpen(!roteiroOpen)}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {roteiroOpen ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            Roteiro
          </button>
          {roteiroOpen &&
            (readOnly ? (
              <p className="text-sm whitespace-pre-wrap rounded-md bg-muted p-3">
                {post.roteiro}
              </p>
            ) : (
              <Textarea
                value={post.roteiro ?? ""}
                onChange={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  onUpdate(index, "roteiro", target.value);
                }}
                rows={5}
                className="text-sm"
              />
            ))}
        </div>
      )}

      {/* Material de estudo (collapsible) */}
      {post.material_estudo && (
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => setMaterialOpen(!materialOpen)}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {materialOpen ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            Material de estudo
          </button>
          {materialOpen && (
            <p className="text-sm whitespace-pre-wrap rounded-md bg-muted p-3">
              {post.material_estudo}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
