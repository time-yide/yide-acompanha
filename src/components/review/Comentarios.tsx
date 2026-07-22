"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Check, MessageSquarePlus } from "lucide-react";
import { comentarAction, resolverComentarioAction } from "@/lib/review/actions";
import type { Comentario } from "@/lib/review/queries";
import type { PlayerHandle } from "./Player";

function fmt(seg: number) { const m = Math.floor(seg / 60), s = Math.floor(seg % 60); return `${m}:${String(s).padStart(2, "0")}`; }

export function Comentarios({ reviewId, versaoId, comentarios, playerRef, podeComentar }: {
  reviewId: string; versaoId: string; comentarios: Comentario[]; playerRef: React.RefObject<PlayerHandle | null>; podeComentar: boolean;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [pending, start] = useTransition();

  function enviar() {
    const tempo = playerRef.current?.tempoAtual() ?? 0;
    start(async () => {
      const r = await comentarAction(reviewId, versaoId, tempo, texto);
      if ("error" in r) { toast.error(r.error); return; }
      setTexto(""); router.refresh();
    });
  }
  function resolver(id: string, val: boolean) {
    start(async () => { await resolverComentarioAction(reviewId, id, val); router.refresh(); });
  }

  return (
    <div className="space-y-3">
      {podeComentar && (
        <div className="flex gap-2">
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Comentar no tempo atual…"
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm" onKeyDown={(e) => e.key === "Enter" && texto.trim() && enviar()} />
          <Button type="button" size="sm" onClick={enviar} disabled={pending || !texto.trim()}>
            <MessageSquarePlus className="h-4 w-4" />
          </Button>
        </div>
      )}
      <div className="space-y-2">
        {comentarios.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sem comentários ainda.</p>
        ) : comentarios.map((c) => (
          <div key={c.id} className={`rounded-md border p-2 text-sm ${c.resolvido ? "opacity-50" : ""}`}>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => playerRef.current?.seek(c.tempo_seg)} className="font-mono text-xs text-primary hover:underline">{fmt(c.tempo_seg)}</button>
              <span className="text-xs font-medium">{c.autor_nome}</span>
              {podeComentar && (
                <button type="button" onClick={() => resolver(c.id, !c.resolvido)} className="ml-auto text-muted-foreground hover:text-emerald-600" title={c.resolvido ? "Reabrir" : "Resolver"}>
                  <Check className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <p className="mt-1">{c.corpo}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
