"use client";

import { useRef, useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Player, type PlayerHandle } from "./Player";
import { Comentarios } from "./Comentarios";
import { UploadVersao } from "./UploadVersao";
import { criarReviewDaTarefaAction, registrarAssistidoAction, linkDownloadAction } from "@/lib/review/tarefa-actions";
import { submitForApprovalAction, approveTaskAction, requestAdjustmentsAction } from "@/lib/tarefas/actions";
import { PCT_MINIMO, destravado } from "@/lib/review/gate";
import type { ReviewDaTarefa } from "@/lib/review/tarefa-queries";
import type { UploadTus } from "@/lib/bunny/client";
import { CheckCircle2, Download, Lock, RotateCcw, Send, Upload, Video } from "lucide-react";

export function VideoDaTarefa({
  taskId, review, podeGerenciar, statusAprovacao, podeAprovar, podeEnviar,
}: {
  taskId: string;
  review: ReviewDaTarefa | null;
  podeGerenciar: boolean;
  statusAprovacao: string | null;
  podeAprovar: boolean;
  podeEnviar: boolean;
}) {
  const router = useRouter();
  const playerRef = useRef<PlayerHandle>(null);
  const [tempo, setTempo] = useState(0);
  const [upload, setUpload] = useState<UploadTus | null>(null);
  const [pending, start] = useTransition();
  const [mostrarAlteracao, setMostrarAlteracao] = useState(false);
  const [obs, setObs] = useState("");
  const versao = review?.versoes[review.versoes.length - 1];
  const [pctVisto, setPctVisto] = useState(review?.assistidoPctVersaoAtual ?? 0);
  const salvoRef = useRef(review?.assistidoPctVersaoAtual ?? 0);

  // Rearma a trava quando muda a versão atual (nova versão = tem que assistir de novo).
  const [versaoAnterior, setVersaoAnterior] = useState(versao?.id);
  if (versao?.id !== versaoAnterior) {
    setVersaoAnterior(versao?.id);
    setPctVisto(review?.assistidoPctVersaoAtual ?? 0);
  }
  useEffect(() => {
    salvoRef.current = review?.assistidoPctVersaoAtual ?? 0;
  }, [versao?.id, review?.assistidoPctVersaoAtual]);

  // Salva o progresso (máximo) de forma throttled quando cresce.
  useEffect(() => {
    if (!versao) return;
    if (pctVisto - salvoRef.current >= 5 || (pctVisto >= PCT_MINIMO && salvoRef.current < PCT_MINIMO)) {
      salvoRef.current = pctVisto;
      registrarAssistidoAction(versao.id, pctVisto);
    }
  }, [pctVisto, versao]);

  function onTime(seg: number, dur: number) {
    setTempo(seg);
    if (dur > 0) setPctVisto((p) => Math.max(p, Math.round((seg / dur) * 100)));
  }

  function novaVersao() {
    start(async () => {
      const r = await criarReviewDaTarefaAction(taskId);
      if ("error" in r) { toast.error(r.error); return; }
      setUpload(r.upload); setPctVisto(0); salvoRef.current = 0; router.refresh();
    });
  }
  function baixar() {
    if (!versao) return;
    start(async () => {
      const r = await linkDownloadAction(versao.id);
      if ("error" in r) { toast.error(r.error); return; }
      window.open(r.url, "_blank");
    });
  }
  function enviarRevisao() {
    start(async () => {
      const r = await submitForApprovalAction(taskId);
      if (r?.error) { toast.error(r.error); return; }
      toast.success("Enviado pra revisão."); router.refresh();
    });
  }
  function aprovar() {
    start(async () => {
      const r = await approveTaskAction(taskId);
      if (r?.error) { toast.error(r.error); return; }
      toast.success("Aprovado!"); router.refresh();
    });
  }
  function pedirAlteracao() {
    if (!obs.trim()) { toast.error("Escreva o que precisa alterar (pode citar os comentários)."); return; }
    const fd = new FormData();
    fd.set("id", taskId);
    fd.set("observacoes", obs.trim());
    start(async () => {
      const r = await requestAdjustmentsAction(fd);
      if (r?.error) { toast.error(r.error); return; }
      toast.success("Enviado pra alteração — o editor vê os comentários."); setMostrarAlteracao(false); setObs(""); router.refresh();
    });
  }

  const liberado = destravado(pctVisto);
  const emAnalise = statusAprovacao === "em_analise";
  const podeSubmeter = podeEnviar && (statusAprovacao === "pendente_envio" || statusAprovacao === "ajustes_solicitados");

  return (
    <Card className="space-y-3 p-4">
      <p className="flex items-center gap-2 text-sm font-medium"><Video className="h-4 w-4" />Vídeo (Frame)</p>

      {!review || !versao ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Nenhum vídeo enviado ainda.</p>
          {podeGerenciar && (upload ? (
            <UploadVersao reviewId={review?.reviewId ?? ""} upload={upload} titulo="video" />
          ) : (
            <Button type="button" size="sm" onClick={novaVersao} disabled={pending}><Upload className="mr-2 h-4 w-4" />Subir vídeo</Button>
          ))}
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-white/10 bg-neutral-950">
            <div className="grid md:grid-cols-[1fr_300px]">
              <div className="aspect-video bg-black">
                {versao.pronto && versao.playlistUrl ? (
                  <Player ref={playerRef} playlistUrl={versao.playlistUrl} marcadores={versao.comentarios.map((c) => c.tempo_seg)} onTime={onTime} onMarcadorClick={(s) => playerRef.current?.seek(s)} />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-white/50">Processando o vídeo…</div>
                )}
              </div>
              <div className="h-[240px] border-t border-white/10 md:h-auto md:border-l md:border-t-0">
                <Comentarios reviewId={review.reviewId} versaoId={versao.id} comentarios={versao.comentarios} playerRef={playerRef} tempoAtual={tempo} podeComentar />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {podeGerenciar && (upload ? (
              <UploadVersao reviewId={review.reviewId} upload={upload} titulo="video" />
            ) : (
              <Button type="button" size="sm" variant="outline" onClick={novaVersao} disabled={pending}><Upload className="mr-2 h-4 w-4" />Nova versão</Button>
            ))}
            {podeSubmeter && (
              <Button type="button" size="sm" onClick={enviarRevisao} disabled={pending}><Send className="mr-2 h-4 w-4" />Enviar pra revisão</Button>
            )}

            <div className="ml-auto flex flex-wrap items-center gap-2">
              {!liberado && (
                <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                  <Lock className="h-3.5 w-3.5" />Assista até o fim ({pctVisto}%/{PCT_MINIMO}%)
                </span>
              )}
              {podeAprovar && emAnalise && (
                <>
                  <Button type="button" size="sm" variant="outline" onClick={() => setMostrarAlteracao((v) => !v)} disabled={pending || !liberado}
                    className="border-amber-500/40 text-amber-600 hover:bg-amber-500/10 dark:text-amber-400">
                    <RotateCcw className="mr-2 h-4 w-4" />Pedir alteração
                  </Button>
                  <Button type="button" size="sm" onClick={aprovar} disabled={pending || !liberado}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />Aprovar
                  </Button>
                </>
              )}
              <Button type="button" size="sm" variant={podeAprovar && emAnalise ? "outline" : "default"} onClick={baixar} disabled={pending || !liberado}>
                <Download className="mr-2 h-4 w-4" />Baixar
              </Button>
            </div>
          </div>

          {mostrarAlteracao && podeAprovar && emAnalise && (
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
              <p className="text-xs font-medium">O que precisa alterar? (o editor vê isto + os comentários no vídeo)</p>
              <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="Ex.: ajustar a música no 0:12; cortar o take duplicado…" />
              <div className="flex justify-end gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => setMostrarAlteracao(false)} disabled={pending}>Cancelar</Button>
                <Button type="button" size="sm" onClick={pedirAlteracao} disabled={pending || !obs.trim()}>Enviar pra alteração</Button>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
