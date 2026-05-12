"use client";

import { useState, useTransition } from "react";
import { Check, ImageIcon as ImageLucide, MessageSquare, ThumbsUp, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { respondToDesignApprovalAction } from "@/lib/design/approval-actions";

interface ArteData {
  id: string;
  titulo: string;
  descricao: string | null;
  formato: string;
  status: string;
  midias: string[];
  copy: string | null;
  hashtags: string | null;
  ajuste_observacoes: string | null;
  client_nome: string;
  organization_nome: string | null;
}

const FORMATO_LABEL: Record<string, string> = {
  feed: "Feed",
  story: "Story",
  carrossel: "Carrossel",
  reels: "Reels",
  outro: "Outro",
};

export function ApprovalClient({ token, arte }: { token: string; arte: ArteData }) {
  const [acao, setAcao] = useState<"aprovar" | "ajuste" | null>(null);
  const [email, setEmail] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<"aprovado" | "ajustes_solicitados" | null>(
    arte.status === "aprovado" ? "aprovado" :
    arte.status === "ajustes_solicitados" ? "ajustes_solicitados" :
    null,
  );

  const jaRespondido = success !== null;
  const [activeIndex, setActiveIndex] = useState(0);
  const cover = arte.midias[activeIndex] ?? arte.midias[0];
  const isVideo = cover?.match(/\.(mp4|mov|webm)$/i);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!acao) return;
    setError(null);

    const fd = new FormData();
    fd.set("token", token);
    fd.set("acao", acao);
    if (email.trim()) fd.set("email", email.trim());
    if (observacoes.trim()) fd.set("observacoes", observacoes.trim());

    startTransition(async () => {
      const r = await respondToDesignApprovalAction(fd);
      if (r.error) {
        setError(r.error);
        if (r.status === "ja_aprovado") setSuccess("aprovado");
        return;
      }
      if (r.success && r.status) {
        setSuccess(r.status === "aprovado" ? "aprovado" : "ajustes_solicitados");
      }
    });
  }

  return (
    <div className="min-h-screen bg-muted/30 py-6 px-4">
      <div className="mx-auto max-w-3xl space-y-5">
        {/* Header */}
        <header className="text-center space-y-2">
          {arte.organization_nome && (
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              {arte.organization_nome}
            </p>
          )}
          <h1 className="text-2xl font-bold tracking-tight">
            Aprovação de arte
          </h1>
          <p className="text-sm text-muted-foreground">
            Cliente: <strong className="text-foreground">{arte.client_nome}</strong>
          </p>
        </header>

        {/* Mídia principal */}
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="relative aspect-square bg-muted/40 max-h-[600px]">
            {cover ? (
              isVideo ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video src={cover} controls className="h-full w-full object-contain" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cover} alt={arte.titulo} className="h-full w-full object-contain" />
              )
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <ImageLucide className="h-10 w-10" />
              </div>
            )}
          </div>

          {/* Thumbnails se carrossel */}
          {arte.midias.length > 1 && (
            <div className="flex gap-2 overflow-x-auto p-3 border-t bg-muted/20">
              {arte.midias.map((url, i) => {
                const v = url.match(/\.(mp4|mov|webm)$/i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveIndex(i)}
                    className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 transition-colors ${i === activeIndex ? "border-primary" : "border-transparent hover:border-muted-foreground/40"}`}
                  >
                    {v ? (
                      // eslint-disable-next-line jsx-a11y/media-has-caption
                      <video src={url} className="h-full w-full object-cover" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt="" className="h-full w-full object-cover" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Info */}
          <div className="p-4 space-y-3">
            <div>
              <h2 className="font-semibold text-lg">{arte.titulo}</h2>
              <p className="text-xs text-muted-foreground">
                {FORMATO_LABEL[arte.formato] ?? arte.formato}
                {arte.midias.length > 1 ? ` · ${arte.midias.length} mídias` : ""}
              </p>
            </div>
            {arte.descricao && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {arte.descricao}
              </p>
            )}
            {arte.copy && (
              <div className="rounded-md border bg-muted/20 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  <MessageSquare className="inline h-3 w-3 mr-1" /> Copy do post
                </p>
                <p className="text-sm whitespace-pre-wrap text-foreground/90">
                  {arte.copy}
                </p>
                {arte.hashtags && (
                  <p className="text-xs text-muted-foreground mt-2 italic">{arte.hashtags}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Status anterior */}
        {arte.ajuste_observacoes && arte.status === "ajustes_solicitados" && !success && (
          <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-3">
            <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">
              Você havia pedido os seguintes ajustes:
            </p>
            <p className="text-xs text-foreground/80 mt-1">{arte.ajuste_observacoes}</p>
          </div>
        )}

        {/* Estado pós-resposta */}
        {success === "aprovado" && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-6 text-center space-y-2">
            <Check className="h-12 w-12 mx-auto text-emerald-600" />
            <h2 className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">
              Arte aprovada!
            </h2>
            <p className="text-sm text-muted-foreground">
              A equipe foi notificada e vai prosseguir com a publicação. Pode fechar essa página.
            </p>
          </div>
        )}
        {success === "ajustes_solicitados" && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-6 text-center space-y-2">
            <Edit3 className="h-12 w-12 mx-auto text-amber-600" />
            <h2 className="text-lg font-semibold text-amber-700 dark:text-amber-300">
              Ajustes registrados
            </h2>
            <p className="text-sm text-muted-foreground">
              A equipe foi notificada do seu pedido de ajuste e vai trabalhar nele.
              Você vai receber uma nova versão pra aprovar em breve.
            </p>
          </div>
        )}

        {/* Form de resposta */}
        {!jaRespondido && (
          <form onSubmit={onSubmit} className="rounded-xl border bg-card p-5 space-y-4">
            {!acao ? (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAcao("aprovar")}
                  className="rounded-lg border-2 border-emerald-500/40 bg-emerald-500/5 p-4 text-center hover:bg-emerald-500/10 transition-colors"
                >
                  <ThumbsUp className="h-8 w-8 mx-auto mb-2 text-emerald-600" />
                  <p className="font-semibold text-emerald-700 dark:text-emerald-300">
                    Aprovar
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Tá tudo certo, pode publicar
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setAcao("ajuste")}
                  className="rounded-lg border-2 border-amber-500/40 bg-amber-500/5 p-4 text-center hover:bg-amber-500/10 transition-colors"
                >
                  <Edit3 className="h-8 w-8 mx-auto mb-2 text-amber-600" />
                  <p className="font-semibold text-amber-700 dark:text-amber-300">
                    Pedir ajuste
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Quero mudar alguma coisa
                  </p>
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Seu email (opcional)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    maxLength={200}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Pra equipe saber quem aprovou.
                  </p>
                </div>

                {acao === "ajuste" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="observacoes">
                      Descreva os ajustes que você quer *
                    </Label>
                    <Textarea
                      id="observacoes"
                      value={observacoes}
                      onChange={(e) => setObservacoes(e.target.value)}
                      placeholder="Ex.: Trocar a cor do fundo pra azul, ajustar o tamanho do logo, mudar o tom do texto..."
                      rows={5}
                      maxLength={2000}
                      required
                      minLength={3}
                    />
                  </div>
                )}

                {error && <p className="text-sm text-destructive">{error}</p>}

                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setAcao(null); setError(null); }}
                    disabled={pending}
                  >
                    Voltar
                  </Button>
                  <Button
                    type="submit"
                    disabled={pending || (acao === "ajuste" && observacoes.trim().length < 3)}
                    className={acao === "aprovar" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-amber-600 hover:bg-amber-700 text-white"}
                  >
                    {pending ? "Enviando..." : (acao === "aprovar" ? "Confirmar aprovação" : "Enviar pedido de ajuste")}
                  </Button>
                </div>
              </>
            )}
          </form>
        )}

        <footer className="text-center text-[10px] text-muted-foreground pt-2">
          Aprovação segura · Link individual · {new Date().getFullYear()}
        </footer>
      </div>
    </div>
  );
}
