"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Player, type PlayerHandle } from "./Player";
import { Comentarios } from "./Comentarios";
import { UploadVersao } from "./UploadVersao";
import { aprovarInternoAction, novaVersaoAction } from "@/lib/review/actions";
import { STATUS_LABEL } from "@/lib/review/schema";
import type { ReviewFull } from "@/lib/review/queries";
import type { UploadTus } from "@/lib/bunny/client";

export function ReviewView({ review, podeGerenciar }: { review: ReviewFull; podeGerenciar: boolean }) {
  const router = useRouter();
  const playerRef = useRef<PlayerHandle>(null);
  const [ativa, setAtiva] = useState(review.versoes.length - 1);
  const [uploadNova, setUploadNova] = useState<UploadTus | null>(null);
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

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{review.titulo}</h1>
          <p className="text-sm text-muted-foreground">{review.clienteNome ?? "Sem cliente"} · <Badge variant="outline">{STATUS_LABEL[review.status]}</Badge></p>
        </div>
        {podeGerenciar && review.status === "revisao_interna" && (
          <Button type="button" onClick={aprovar} disabled={pending}>Aprovar internamente</Button>
        )}
      </header>

      {review.versoes.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">Nenhuma versão ainda.</Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
          <div className="space-y-2">
            {versao.pronto && versao.playlistUrl ? (
              <Player ref={playerRef} playlistUrl={versao.playlistUrl} />
            ) : (
              <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-muted px-4 text-center text-sm text-muted-foreground">
                {versao.playlistUrl ? "Processando o vídeo…" : "Player de vídeo (Bunny) ainda não configurado — veja docs/frame-interno-bunny-setup.md"}
              </div>
            )}
            <div className="flex flex-wrap gap-1">
              {review.versoes.map((v, i) => (
                <Button key={v.id} type="button" size="sm" variant={i === ativa ? "default" : "outline"} onClick={() => setAtiva(i)}>v{v.numero}</Button>
              ))}
            </div>
          </div>
          <Card className="p-3">
            <Comentarios reviewId={review.id} versaoId={versao.id} comentarios={versao.comentarios} playerRef={playerRef} podeComentar />
          </Card>
        </div>
      )}

      {podeGerenciar && (
        <Card className="flex flex-wrap items-center gap-3 p-3">
          {uploadNova ? (
            <UploadVersao reviewId={review.id} upload={uploadNova} titulo={review.titulo} />
          ) : (
            <Button type="button" variant="outline" onClick={pedirNova} disabled={pending}>Subir nova versão</Button>
          )}
        </Card>
      )}
    </div>
  );
}
