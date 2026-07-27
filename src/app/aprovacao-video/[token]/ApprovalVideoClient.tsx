"use client";

import { useRef, useState } from "react";
import { CheckCircle2, MessageSquarePlus, RotateCcw } from "lucide-react";
import { Player, type PlayerHandle, fmtTempo } from "@/components/review/Player";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ReviewCliente } from "@/lib/review/aprovacao-cliente-utils";
import {
  comentarComoClienteAction,
  aprovarComoClienteAction,
  pedirAlteracaoComoClienteAction,
} from "@/lib/review/aprovacao-cliente";

export function ApprovalVideoClient({ token, review }: { token: string; review: ReviewCliente }) {
  const [status, setStatus] = useState(review.status);
  const [comentarios, setComentarios] = useState(review.comentarios);
  const [corpo, setCorpo] = useState("");
  const [pino, setPino] = useState<{ x: number; y: number } | null>(null);
  const [modoPino, setModoPino] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const playerRef = useRef<PlayerHandle>(null);

  const podeAgir = status === "revisao_cliente";

  async function enviarComentario() {
    if (!corpo.trim()) return;
    setEnviando(true);
    setErro(null);
    const t = playerRef.current?.tempoAtual() ?? 0;
    const r = await comentarComoClienteAction(token, t, corpo, pino?.x ?? null, pino?.y ?? null);
    setEnviando(false);
    if ("error" in r) {
      setErro(r.error);
      return;
    }
    setComentarios((prev) => [
      ...prev,
      {
        id: `tmp-${prev.length}-${Math.round(t)}`,
        autor_tipo: "cliente",
        autor_nome: review.clienteNome,
        tempo_seg: Math.round(t),
        corpo: corpo.trim(),
        pos_x: pino?.x ?? null,
        pos_y: pino?.y ?? null,
        created_at: new Date().toISOString(),
      },
    ]);
    setCorpo("");
    setPino(null);
    setModoPino(false);
  }

  async function aprovar() {
    setEnviando(true);
    setErro(null);
    const r = await aprovarComoClienteAction(token);
    setEnviando(false);
    if ("error" in r) {
      setErro(r.error);
      return;
    }
    setStatus("aprovado");
  }

  async function pedirAlteracao() {
    if (comentarios.length === 0) {
      setErro("Escreva pelo menos um comentário dizendo o que mudar.");
      return;
    }
    setEnviando(true);
    setErro(null);
    const r = await pedirAlteracaoComoClienteAction(token);
    setEnviando(false);
    if ("error" in r) {
      setErro(r.error);
      return;
    }
    setStatus("ajustes");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold">{review.titulo}</h1>
        <p className="text-sm text-muted-foreground">Assista, comente e aprove ou peça alteração.</p>
      </header>

      {!review.pronto ? (
        <div className="rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          O vídeo ainda está processando. Recarregue em alguns instantes.
        </div>
      ) : (
        <div className="relative aspect-video w-full overflow-hidden rounded-xl border">
          <Player
            ref={playerRef}
            playlistUrl={review.playlistUrl}
            marcadores={comentarios.map((c) => c.tempo_seg)}
            onMarcadorClick={(seg) => playerRef.current?.seek(seg)}
            modoPino={modoPino}
            pino={pino}
            onPinPlace={(x, y) => setPino({ x, y })}
          />
        </div>
      )}

      {status === "aprovado" && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" /> Vídeo aprovado. Obrigado!
        </div>
      )}
      {status === "ajustes" && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
          Alteração enviada pra equipe. Você recebe uma nova versão em breve.
        </div>
      )}
      {status === "revisao_interna" && (
        <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
          A equipe ainda está ajustando este vídeo. Aguarde o envio.
        </div>
      )}

      {podeAgir && (
        <>
          <div className="space-y-2 rounded-xl border p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Comentar {pino ? "(ponto marcado)" : ""}</p>
              <button
                type="button"
                onClick={() => setModoPino((v) => !v)}
                className="inline-flex items-center gap-1 text-xs text-primary"
              >
                <MessageSquarePlus className="h-3.5 w-3.5" /> {modoPino ? "Cancelar marcação" : "Marcar ponto no vídeo"}
              </button>
            </div>
            <Textarea
              value={corpo}
              onChange={(e) => setCorpo(e.target.value)}
              rows={2}
              placeholder="Ex.: no 0:12 trocar a música…"
              maxLength={1000}
            />
            <div className="flex justify-end">
              <Button type="button" size="sm" onClick={enviarComentario} disabled={enviando || !corpo.trim()}>
                Adicionar comentário
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={aprovar} disabled={enviando} className="bg-emerald-600 hover:bg-emerald-700">
              <CheckCircle2 className="mr-1.5 h-4 w-4" /> Aprovar
            </Button>
            <Button type="button" variant="outline" onClick={pedirAlteracao} disabled={enviando}>
              <RotateCcw className="mr-1.5 h-4 w-4" /> Pedir alteração
            </Button>
          </div>
        </>
      )}

      {comentarios.length > 0 && (
        <ul className="space-y-1.5">
          {comentarios.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => playerRef.current?.seek(c.tempo_seg)}
                className="flex w-full items-start gap-2 rounded-lg border bg-card px-3 py-2 text-left text-sm hover:bg-muted/50"
              >
                <span className="font-mono text-xs text-primary">{fmtTempo(c.tempo_seg)}</span>
                <span className="min-w-0 flex-1">{c.corpo}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {erro && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}
    </div>
  );
}
