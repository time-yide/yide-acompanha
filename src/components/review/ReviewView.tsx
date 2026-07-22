"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Player, type PlayerHandle } from "./Player";
import { Comentarios } from "./Comentarios";
import { UploadVersao } from "./UploadVersao";
import { aprovarInternoAction, novaVersaoAction } from "@/lib/review/actions";
import { STATUS_LABEL } from "@/lib/review/schema";
import type { ReviewFull } from "@/lib/review/queries";
import type { UploadTus } from "@/lib/bunny/client";
import { ArrowLeft, CheckCircle2, Plus } from "lucide-react";

export function ReviewView({ review, podeGerenciar }: { review: ReviewFull; podeGerenciar: boolean }) {
  const router = useRouter();
  const playerRef = useRef<PlayerHandle>(null);
  const [ativa, setAtiva] = useState(Math.max(0, review.versoes.length - 1));
  const [uploadNova, setUploadNova] = useState<UploadTus | null>(null);
  const [tempo, setTempo] = useState(0);
  const [pending, start] = useTransition();
  const versao = review.versoes[ativa];

  function aprovar() {
    start(async () => {
      const r = await aprovarInternoAction(review.id);
      if ("error" in r) { toast.error(r.error); return; }
      toast.success("Aprovado internamente!"); router.refresh();
    });
  }
  function pedirNova() {
    start(async () => {
      const r = await novaVersaoAction(review.id, review.titulo);
      if ("error" in r) { toast.error(r.error); return; }
      setUploadNova(r); router.refresh();
    });
  }

  const marcadores = versao ? versao.comentarios.map((c) => c.tempo_seg) : [];

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

        <div className="ml-auto flex items-center gap-2">
          {podeGerenciar && review.status === "revisao_interna" && (
            <Button type="button" size="sm" onClick={aprovar} disabled={pending}>
              <CheckCircle2 className="mr-2 h-4 w-4" />Aprovar internamente
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
              onTime={(seg) => setTempo(seg)}
              onMarcadorClick={(seg) => playerRef.current?.seek(seg)}
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
            />
          </aside>
        )}
      </div>
    </div>
  );
}
