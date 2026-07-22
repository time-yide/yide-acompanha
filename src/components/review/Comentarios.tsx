"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, MessageSquare, Send } from "lucide-react";
import { comentarAction, resolverComentarioAction } from "@/lib/review/actions";
import type { Comentario } from "@/lib/review/queries";
import type { PlayerHandle } from "./Player";
import { fmtTempo } from "./Player";

function iniciais(nome: string) {
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export function Comentarios({ reviewId, versaoId, comentarios, playerRef, tempoAtual, podeComentar }: {
  reviewId: string;
  versaoId: string;
  comentarios: Comentario[];
  playerRef: React.RefObject<PlayerHandle | null>;
  tempoAtual: number;
  podeComentar: boolean;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [pending, start] = useTransition();

  function enviar() {
    if (!texto.trim()) return;
    const tempo = playerRef.current?.tempoAtual() ?? tempoAtual;
    start(async () => {
      const r = await comentarAction(reviewId, versaoId, tempo, texto);
      if ("error" in r) { toast.error(r.error); return; }
      setTexto(""); router.refresh();
    });
  }
  function resolver(id: string, val: boolean) {
    start(async () => { await resolverComentarioAction(reviewId, id, val); router.refresh(); });
  }

  const ordenados = [...comentarios].sort((a, b) => a.tempo_seg - b.tempo_seg);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <p className="text-sm font-semibold text-white">Comentários</p>
        <span className="text-xs text-white/40">{comentarios.length}</span>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto px-2 py-2">
        {ordenados.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-xs text-white/40">
            <MessageSquare className="h-6 w-6 opacity-40" />
            Nenhum comentário ainda.<br />Dê play e comente no momento exato.
          </div>
        ) : ordenados.map((c) => (
          <div key={c.id} className={`group rounded-lg px-3 py-2.5 transition hover:bg-white/[0.04] ${c.resolvido ? "opacity-45" : ""}`}>
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-semibold text-primary">
                {iniciais(c.autor_nome)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-xs font-medium text-white">{c.autor_nome}</span>
                  <button
                    type="button"
                    onClick={() => playerRef.current?.seek(c.tempo_seg)}
                    className="rounded bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-primary hover:bg-primary/25"
                  >
                    {fmtTempo(c.tempo_seg)}
                  </button>
                  {podeComentar && (
                    <button
                      type="button"
                      onClick={() => resolver(c.id, !c.resolvido)}
                      title={c.resolvido ? "Reabrir" : "Resolver"}
                      className={`ml-auto opacity-0 transition group-hover:opacity-100 ${c.resolvido ? "text-emerald-400 opacity-100" : "text-white/40 hover:text-emerald-400"}`}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <p className="mt-1 break-words text-sm text-white/85">{c.corpo}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {podeComentar && (
        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-2 rounded-lg bg-white/[0.06] px-2 py-1.5 ring-1 ring-white/10 focus-within:ring-primary/50">
            <span className="rounded bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-primary">{fmtTempo(tempoAtual)}</span>
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") enviar(); }}
              placeholder="Comentar neste momento…"
              className="flex-1 bg-transparent text-sm text-white placeholder:text-white/35 focus:outline-none"
            />
            <button type="button" onClick={enviar} disabled={pending || !texto.trim()} className="text-primary disabled:text-white/20" aria-label="Enviar">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
