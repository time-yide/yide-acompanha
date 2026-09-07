"use client";

import { useState } from "react";
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

function EditableField({
  value,
  field,
  onSave,
  readOnly,
  multiline,
  placeholder,
}: {
  value: string;
  field: string;
  onSave: (value: string) => void;
  readOnly: boolean;
  multiline?: boolean;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (readOnly || !editing) {
    return (
      <span className="group/edit inline">
        {field === "tema" ? (
          <span className="text-lg font-semibold text-foreground">
            {value || placeholder || "Sem título"}
          </span>
        ) : field === "legenda" ? (
          <span className="whitespace-pre-wrap leading-relaxed text-foreground/90">
            {value || "—"}
          </span>
        ) : field === "hashtags" ? (
          <span className="text-sm text-primary/70">{value || "—"}</span>
        ) : (
          <span className="text-sm">{value || "—"}</span>
        )}
        {!readOnly && (
          <button
            type="button"
            onClick={() => {
              setDraft(value);
              setEditing(true);
            }}
            className="ml-1.5 inline-flex translate-y-[-1px] rounded p-0.5 text-muted-foreground/40 opacity-0 transition-opacity hover:text-foreground group-hover/edit:opacity-100"
            title="Editar"
          >
            <Pencil className="h-3 w-3" />
          </button>
        )}
      </span>
    );
  }

  function save() {
    onSave(draft);
    setEditing(false);
  }

  function cancel() {
    setDraft(value);
    setEditing(false);
  }

  return (
    <span className="flex items-start gap-1.5">
      {multiline ? (
        <Textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft((e.target as HTMLTextAreaElement).value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") cancel();
          }}
          rows={4}
          className="min-h-[80px] text-sm"
        />
      ) : (
        <Input
          autoFocus
          type={field === "data_sugerida" ? "date" : "text"}
          value={draft}
          onChange={(e) => setDraft((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") cancel();
          }}
          className="h-7 text-sm"
        />
      )}
      <Button size="icon-xs" variant="ghost" onClick={save} className="h-6 w-6 shrink-0 text-emerald-600">
        <Check className="h-3 w-3" />
      </Button>
      <Button size="icon-xs" variant="ghost" onClick={cancel} className="h-6 w-6 shrink-0 text-muted-foreground">
        <X className="h-3 w-3" />
      </Button>
    </span>
  );
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
  const tipoColor = TIPO_COLORS[post.tipo];

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

  function handleFieldSave(field: string) {
    return (value: string) => {
      onUpdate(index, field, value);
    };
  }

  return (
    <article className="group relative">
      {/* Post header bar */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider ${tipoColor}`}>
            <Icon className="h-3.5 w-3.5" />
            {TIPO_LABELS[post.tipo]} #{post.ordem}
          </span>
          <span className="text-muted-foreground/30">·</span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarIcon className="h-3 w-3" />
            <EditableField
              value={post.data_sugerida}
              field="data_sugerida"
              onSave={handleFieldSave("data_sugerida")}
              readOnly={readOnly}
            />
          </span>
        </div>
        {!readOnly && (
          <Button
            size="xs"
            variant="ghost"
            onClick={handleRegenerate}
            disabled={regenerating}
            className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
          >
            <RefreshCw className={`h-3 w-3 ${regenerating ? "animate-spin" : ""}`} />
            Regenerar
          </Button>
        )}
      </div>

      {/* Tema — heading */}
      <div className="mb-2">
        <EditableField
          value={post.tema}
          field="tema"
          onSave={handleFieldSave("tema")}
          readOnly={readOnly}
        />
      </div>

      {/* Legenda — body text (modo completo) */}
      {modo === "completo" && (
        <div className="mb-3">
          <EditableField
            value={post.legenda ?? ""}
            field="legenda"
            onSave={handleFieldSave("legenda")}
            readOnly={readOnly}
            multiline
          />
        </div>
      )}

      {/* Hashtags (modo completo) */}
      {modo === "completo" && (
        <div className="mb-3">
          <EditableField
            value={(post.hashtags ?? []).join(" ")}
            field="hashtags"
            onSave={handleFieldSave("hashtags")}
            readOnly={readOnly}
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
              <EditableField
                value={post.roteiro ?? ""}
                field="roteiro"
                onSave={handleFieldSave("roteiro")}
                readOnly={readOnly}
                multiline
              />
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
