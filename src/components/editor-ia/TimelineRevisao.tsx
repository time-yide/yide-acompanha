"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { salvarPlanoAction, renderizarAction } from "@/lib/editor-ia/actions";
import type { EditPlan, EditSegment, CaptionLine } from "@/lib/editor-ia/tipos";

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

interface Props {
  jobId: string;
  videoUrl: string | null;
  editPlan: EditPlan;
}

export function TimelineRevisao({ jobId, videoUrl, editPlan }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isRenderPending, startRenderTransition] = useTransition();
  // Defensivo: se o edit_plan vier malformado (sem os arrays), cai pra vazio
  // em vez de quebrar no client ("Cannot read properties of undefined").
  const [segments, setSegments] = useState<EditSegment[]>(
    Array.isArray(editPlan?.segments) ? editPlan.segments : []
  );
  const [captions, setCaptions] = useState<CaptionLine[]>(
    Array.isArray(editPlan?.captions) ? editPlan.captions : []
  );
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  function toggleSegment(index: number) {
    setSegments((prev) =>
      prev.map((seg, i) => (i === index ? { ...seg, keep: !seg.keep } : seg))
    );
    setSaved(false);
  }

  function updateCaptionText(index: number, text: string) {
    setCaptions((prev) =>
      prev.map((cap, i) => (i === index ? { ...cap, text } : cap))
    );
    setSaved(false);
  }

  function handleRenderizar() {
    setRenderError(null);
    const fd = new FormData();
    fd.set("id", jobId);
    startRenderTransition(async () => {
      const result = await renderizarAction(fd);
      if ("error" in result) {
        setRenderError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  function handleSave() {
    setSaveError(null);
    setSaved(false);
    const fd = new FormData();
    fd.set("id", jobId);
    fd.set("edit_plan", JSON.stringify({ segments, captions }));
    startTransition(async () => {
      const result = await salvarPlanoAction(fd);
      if ("error" in result) {
        setSaveError(result.error);
      } else {
        setSaved(true);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      {videoUrl && (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Video original</p>
          <video src={videoUrl} controls className="w-full max-h-[40vh] rounded-md border" />
        </div>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold">Trechos ({segments.length})</h2>
        {segments.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhum trecho.</p>
        )}
        <ul className="space-y-1">
          {segments.map((seg, i) => (
            <li
              key={i}
              className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm transition-opacity ${
                seg.keep ? "" : "opacity-50"
              }`}
            >
              <span className={`font-mono text-xs ${seg.keep ? "" : "line-through text-muted-foreground"}`}>
                {fmt(seg.start)} – {fmt(seg.end)}
              </span>
              <button
                type="button"
                onClick={() => toggleSegment(i)}
                className={`ml-auto rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                  seg.keep
                    ? "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300"
                    : "bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300"
                }`}
              >
                {seg.keep ? "Manter" : "Cortar"}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Legendas ({captions.length})</h2>
        {captions.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhuma legenda.</p>
        )}
        <ul className="space-y-2">
          {captions.map((cap, i) => (
            <li key={i} className="flex items-start gap-3 rounded-md border px-3 py-2 text-sm">
              <span className="shrink-0 font-mono text-xs text-muted-foreground pt-1">
                {fmt(cap.start)} – {fmt(cap.end)}
              </span>
              <input
                type="text"
                value={cap.text}
                onChange={(e) => updateCaptionText(i, e.target.value)}
                className="flex-1 rounded border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                maxLength={500}
              />
            </li>
          ))}
        </ul>
      </section>

      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending || isRenderPending}
            className="rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "Salvando..." : "Salvar"}
          </button>
          <button
            type="button"
            onClick={handleRenderizar}
            disabled={isPending || isRenderPending}
            className="rounded-md border border-input bg-background px-4 py-2 text-xs font-medium hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
          >
            {isRenderPending ? "Enviando..." : "Renderizar"}
          </button>
          {saved && (
            <span className="text-xs text-green-600 dark:text-green-400">Salvo</span>
          )}
          {saveError && (
            <span className="text-xs text-destructive">{saveError}</span>
          )}
        </div>
        {renderError && (
          <p className="text-xs text-destructive">{renderError}</p>
        )}
        <p className="text-xs text-muted-foreground">O render pode levar alguns minutos.</p>
      </div>
    </div>
  );
}
