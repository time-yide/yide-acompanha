"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, AlertCircle, CheckCircle2 } from "lucide-react";
import { ApresentacaoEditor } from "./ApresentacaoEditor";
import type { Slide } from "@/lib/apresenta-yide/tipos";

interface Props {
  apresentacaoId: string;
  titulo: string;
  /** Slides já persistidos quando o user reabre a página mid-stream. */
  initialSlides: Slide[];
  numSlidesAlvo: number;
}

type StreamState =
  | { kind: "iniciando" }
  | { kind: "gerando"; slides: Slide[] }
  | { kind: "pronta"; slides: Slide[] }
  | { kind: "erro"; mensagem: string; slides: Slide[] };

/**
 * Inicia (ou retoma) o streaming da geração ao montar. Faz POST pro
 * endpoint e consome resposta NDJSON, atualizando state de slides ao
 * vivo. Quando recebe "done", chama router.refresh() pra a página
 * server-rendered substituir esse client component pelo ApresentacaoEditor
 * estático.
 */
export function StreamingApresentacao({
  apresentacaoId,
  titulo,
  initialSlides,
  numSlidesAlvo,
}: Props) {
  const router = useRouter();
  const [state, setState] = useState<StreamState>({
    kind: "gerando",
    slides: initialSlides,
  });
  // Evita chamadas duplicadas em StrictMode dev.
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;

    async function run() {
      try {
        const res = await fetch(`/api/apresenta-yide/${apresentacaoId}/gerar`, {
          method: "POST",
        });
        if (!res.ok) {
          let msg = `HTTP ${res.status}`;
          try {
            const json = await res.json();
            if (json.error) msg = json.error;
          } catch { /* body não é JSON */ }
          if (!cancelled) setState((prev) => ({ kind: "erro", mensagem: msg, slides: getSlides(prev) }));
          return;
        }
        if (!res.body) throw new Error("Sem body de resposta");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let slidesAtuais = initialSlides.slice();

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let nlIdx: number;
          while ((nlIdx = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, nlIdx).trim();
            buffer = buffer.slice(nlIdx + 1);
            if (!line) continue;

            let event: { type: string; [k: string]: unknown };
            try {
              event = JSON.parse(line);
            } catch {
              continue;
            }

            if (event.type === "slide") {
              slidesAtuais = [...slidesAtuais, event.slide as Slide];
              if (!cancelled) setState({ kind: "gerando", slides: slidesAtuais });
            } else if (event.type === "done") {
              if (!cancelled) setState({ kind: "pronta", slides: slidesAtuais });
              // Refresh server-side pra trocar pro ApresentacaoEditor estático
              router.refresh();
              return;
            } else if (event.type === "error") {
              if (!cancelled) setState({
                kind: "erro",
                mensagem: (event.message as string) ?? "Erro desconhecido",
                slides: slidesAtuais,
              });
              return;
            }
          }
        }
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Falha desconhecida";
        setState((prev) => ({ kind: "erro", mensagem: msg, slides: getSlides(prev) }));
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [apresentacaoId, initialSlides, router]);

  const slides = getSlides(state);

  return (
    <div className="space-y-4">
      <StatusBanner state={state} numSlidesAlvo={numSlidesAlvo} />
      {slides.length > 0 ? (
        <ApresentacaoEditor slides={slides} titulo={titulo} />
      ) : (
        <SkeletonPreview />
      )}
    </div>
  );
}

function getSlides(s: StreamState): Slide[] {
  if (s.kind === "iniciando") return [];
  return s.slides;
}

function StatusBanner({ state, numSlidesAlvo }: { state: StreamState; numSlidesAlvo: number }) {
  if (state.kind === "iniciando" || state.kind === "gerando") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary">
        <Sparkles className="h-4 w-4 animate-pulse" />
        Gerando slides com IA… ({state.kind === "gerando" ? state.slides.length : 0}/{numSlidesAlvo})
      </div>
    );
  }
  if (state.kind === "pronta") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-4 w-4" />
        Apresentação pronta. {state.slides.length} slides gerados.
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <div>
        <strong>Erro ao gerar:</strong> {state.mensagem}
      </div>
    </div>
  );
}

function SkeletonPreview() {
  return (
    <div className="aspect-[16/9] w-full animate-pulse rounded-xl border border-dashed bg-muted/20" />
  );
}
