"use client";

import Link from "next/link";
import { useRef, useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Player, type PlayerHandle } from "./Player";
import { Comentarios } from "./Comentarios";
import { UploadVersao } from "./UploadVersao";
import { aprovarVideoAction, novaVersaoAction, pedirAlteracaoAction } from "@/lib/review/actions";
import { registrarAssistidoAction, linkDownloadAction } from "@/lib/review/tarefa-actions";
import { PCT_MINIMO, destravado } from "@/lib/review/gate";
import { STATUS_LABEL } from "@/lib/review/schema";
import type { ReviewFull } from "@/lib/review/queries";
import type { UploadTus } from "@/lib/bunny/client";
import { ArrowLeft, CheckCircle2, Download, Lock, Plus, RotateCcw } from "lucide-react";

export function ReviewView({ review, podeGerenciar, podeAprovar }: { review: ReviewFull; podeGerenciar: boolean; podeAprovar: boolean }) {
  const router = useRouter();
  const playerRef = useRef<PlayerHandle>(null);
  const [ativa, setAtiva] = useState(Math.max(0, review.versoes.length - 1));
  const [uploadNova, setUploadNova] = useState<UploadTus | null>(null);
  const [tempo, setTempo] = useState(0);
  const [pending, start] = useTransition();
  const versao = review.versoes[ativa];

  // Anotação "alfinete/balão" no frame.
  // modoPino: clicar no vídeo posiciona o alfinete do próximo comentário.
  // pinoNovo: alfinete pendente (0..1) a anexar no comentário sendo escrito.
  // pinoView: alfinete de um comentário existente que foi clicado (com balão).
  const [modoPino, setModoPino] = useState(false);
  const [pinoNovo, setPinoNovo] = useState<{ x: number; y: number } | null>(null);
  const [pinoView, setPinoView] = useState<{ x: number; y: number; corpo: string } | null>(null);

  // Watch tracking: semente vinda do server pra a versão atual (última).
  const [pctVisto, setPctVisto] = useState(review.assistidoPctVersaoAtual);
  const salvoRef = useRef(review.assistidoPctVersaoAtual);

  // Rearma a trava quando muda a versão ativa (nova versão = assistir de novo).
  const [versaoAnterior, setVersaoAnterior] = useState(versao?.id);
  if (versao?.id !== versaoAnterior) {
    setVersaoAnterior(versao?.id);
    // Só a versão atual (última) traz % semeado; versões anteriores começam do zero.
    const ehAtual = ativa === review.versoes.length - 1;
    setPctVisto(ehAtual ? review.assistidoPctVersaoAtual : 0);
    // Zera a marcação ao trocar de versão (os pinos são por comentário/versão).
    setModoPino(false);
    setPinoNovo(null);
    setPinoView(null);
  }
  useEffect(() => {
    const ehAtual = ativa === review.versoes.length - 1;
    salvoRef.current = ehAtual ? review.assistidoPctVersaoAtual : 0;
  }, [versao?.id, ativa, review.versoes.length, review.assistidoPctVersaoAtual]);

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

  function aprovar() {
    start(async () => {
      const r = await aprovarVideoAction(review.id);
      if ("error" in r) { toast.error(r.error); return; }
      toast.success("Vídeo aprovado!"); router.refresh();
    });
  }
  function pedirNova() {
    start(async () => {
      const r = await novaVersaoAction(review.id, review.titulo);
      if ("error" in r) { toast.error(r.error); return; }
      setUploadNova(r); router.refresh();
    });
  }
  function pedirAlteracao() {
    if (!window.confirm("Pedir alteração deste vídeo? O editor verá os comentários no vídeo.")) return;
    start(async () => {
      const r = await pedirAlteracaoAction(review.id);
      if ("error" in r) { toast.error(r.error); return; }
      toast.success("Enviado pra alteração — o editor vai ver os comentários."); router.refresh();
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

  const marcadores = versao ? versao.comentarios.map((c) => c.tempo_seg) : [];
  const liberado = destravado(pctVisto);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-950 text-white">
      {/* Barra do topo */}
      <div className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-2.5">
        <Link href="/audiovisual/review" className="flex h-8 w-8 items-center justify-center rounded-md text-white/70 hover:bg-white/10 hover:text-white" aria-label="Voltar">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold leading-tight">{review.titulo}</h1>
          <p className="truncate text-[11px] text-white/45">{review.clienteNome ?? "Sem cliente"} · {STATUS_LABEL[review.status]}</p>
        </div>

        {review.versoes.length > 0 && (
          <div className="flex items-center gap-1 rounded-lg bg-white/[0.06] p-0.5 ring-1 ring-white/10">
            {review.versoes.map((v, i) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setAtiva(i)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${i === ativa ? "bg-primary text-primary-foreground" : "text-white/60 hover:bg-white/10"}`}
              >
                v{v.numero}
              </button>
            ))}
          </div>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {!liberado && versao && (
            <span className="flex items-center gap-1 text-xs text-amber-400">
              <Lock className="h-3.5 w-3.5" />Assista até o fim ({pctVisto}%/{PCT_MINIMO}%)
            </span>
          )}
          {podeAprovar && review.status !== "aprovado" && (
            <>
              <Button type="button" size="sm" variant="outline" onClick={pedirAlteracao} disabled={pending} className="border-amber-500/40 bg-transparent text-amber-500 hover:bg-amber-500/10 hover:text-amber-400">
                <RotateCcw className="mr-2 h-4 w-4" />Pedir alteração
              </Button>
              <Button type="button" size="sm" onClick={aprovar} disabled={pending || !liberado}>
                <CheckCircle2 className="mr-2 h-4 w-4" />Aprovar
              </Button>
            </>
          )}
          {versao && (
            <Button type="button" size="sm" variant="outline" onClick={baixar} disabled={pending || !liberado} className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white">
              <Download className="mr-2 h-4 w-4" />Baixar
            </Button>
          )}
          {podeGerenciar && !uploadNova && (
            <Button type="button" size="sm" variant="outline" onClick={pedirNova} disabled={pending} className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white">
              <Plus className="mr-2 h-4 w-4" />Nova versão
            </Button>
          )}
        </div>
      </div>

      {podeGerenciar && uploadNova && (
        <div className="flex items-center gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-2">
          <span className="text-xs text-white/60">Envie o arquivo da nova versão:</span>
          <UploadVersao reviewId={review.id} upload={uploadNova} titulo={review.titulo} />
        </div>
      )}

      {/* Corpo: player (grande) + comentários (lateral, altura cheia) */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="min-h-0 flex-1 bg-black">
          {review.versoes.length === 0 || !versao ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-white/45">
              Nenhuma versão ainda. {podeGerenciar && "Clique em “Nova versão” pra enviar o vídeo."}
            </div>
          ) : versao.pronto && versao.playlistUrl ? (
            <Player
              ref={playerRef}
              playlistUrl={versao.playlistUrl}
              marcadores={marcadores}
              onTime={onTime}
              onMarcadorClick={(seg) => { setPinoView(null); playerRef.current?.seek(seg); }}
              modoPino={modoPino}
              onPinPlace={(x, y) => setPinoNovo({ x, y })}
              pino={modoPino ? pinoNovo : pinoView ? { x: pinoView.x, y: pinoView.y } : null}
              pinoLabel={modoPino ? null : pinoView?.corpo ?? null}
            />
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-white/50">
              {versao.playlistUrl ? "Processando o vídeo…" : "Player de vídeo (Bunny) ainda não configurado — veja docs/frame-interno-bunny-setup.md"}
            </div>
          )}
        </div>

        {versao && (
          <aside className="flex h-[45vh] w-full shrink-0 flex-col border-t border-white/10 lg:h-auto lg:w-[360px] lg:border-l lg:border-t-0">
            <Comentarios
              reviewId={review.id}
              versaoId={versao.id}
              comentarios={versao.comentarios}
              playerRef={playerRef}
              tempoAtual={tempo}
              podeComentar
              modoPino={modoPino}
              onToggglePino={() => { setPinoView(null); setModoPino((m) => { if (m) setPinoNovo(null); return !m; }); }}
              pinoNovo={pinoNovo}
              limparPino={() => { setModoPino(false); setPinoNovo(null); }}
              onSelecionar={(c) => {
                setModoPino(false);
                playerRef.current?.seek(c.tempo_seg);
                setPinoView(c.pos_x != null && c.pos_y != null ? { x: c.pos_x, y: c.pos_y, corpo: c.corpo } : null);
              }}
            />
          </aside>
        )}
      </div>
    </div>
  );
}
