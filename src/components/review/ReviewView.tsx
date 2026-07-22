"use client";

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
import { CheckCircle2, Clapperboard, Plus } from "lucide-react";

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
    <div className="space-y-3">
      {/* Barra do topo (breadcrumb + versões + ações) */}
      <div className="flex flex-wrap items-center gap-3">
        <Clapperboard className="h-5 w-5 text-muted-foreground" />
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold leading-tight">{review.titulo}</h1>
          <p className="text-xs text-muted-foreground">
            {review.clienteNome ?? "Sem cliente"} · {STATUS_LABEL[review.status]}
          </p>
        </div>

        {review.versoes.length > 0 && (
          <div className="flex items-center gap-1 rounded-lg border bg-card p-0.5">
            {review.versoes.map((v, i) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setAtiva(i)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${i === ativa ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
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
          {podeGerenciar && (
            uploadNova ? null : (
              <Button type="button" size="sm" variant="outline" onClick={pedirNova} disabled={pending}>
                <Plus className="mr-2 h-4 w-4" />Nova versão
              </Button>
            )
          )}
        </div>
      </div>

      {podeGerenciar && uploadNova && (
        <div className="rounded-lg border bg-card p-3">
          <p className="mb-2 text-sm text-muted-foreground">Envie o arquivo da nova versão:</p>
          <UploadVersao reviewId={review.id} upload={uploadNova} titulo={review.titulo} />
        </div>
      )}

      {/* Painel principal estilo Frame */}
      {review.versoes.length === 0 || !versao ? (
        <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
          Nenhuma versão ainda. {podeGerenciar && "Clique em “Nova versão” pra enviar o vídeo."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-neutral-950">
          <div className="grid lg:grid-cols-[1fr_340px]">
            {/* Player */}
            <div className="p-3">
              {versao.pronto && versao.playlistUrl ? (
                <Player
                  ref={playerRef}
                  playlistUrl={versao.playlistUrl}
                  marcadores={marcadores}
                  onTime={(seg) => setTempo(seg)}
                  onMarcadorClick={(seg) => playerRef.current?.seek(seg)}
                />
              ) : (
                <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-neutral-900 px-4 text-center text-sm text-white/50">
                  {versao.playlistUrl ? "Processando o vídeo…" : "Player de vídeo (Bunny) ainda não configurado — veja docs/frame-interno-bunny-setup.md"}
                </div>
              )}
            </div>

            {/* Comentários */}
            <div className="border-t border-white/10 lg:border-l lg:border-t-0">
              <div className="h-[300px] lg:h-[520px]">
                <Comentarios
                  reviewId={review.id}
                  versaoId={versao.id}
                  comentarios={versao.comentarios}
                  playerRef={playerRef}
                  tempoAtual={tempo}
                  podeComentar
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
