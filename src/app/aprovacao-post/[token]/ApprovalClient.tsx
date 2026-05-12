"use client";

import { useState, useTransition } from "react";
import { Check, ImageIcon as ImageLucide, MessageSquare, ThumbsUp, Edit3, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { respondToSocialApprovalAction } from "@/lib/social-media/approval-actions";

interface PostData {
  id: string;
  titulo: string | null;
  legenda: string | null;
  hashtags: string | null;
  primeiro_comentario: string | null;
  formato: string;
  redes: string[];
  status: string;
  midias: string[];
  ajuste_observacoes: string | null;
  agendar_para: string | null;
  client_nome: string;
  organization_nome: string | null;
}

const FORMATO_LABEL: Record<string, string> = {
  feed: "Feed",
  story: "Story",
  carrossel: "Carrossel",
  reels: "Reels",
};

const REDE_LABEL: Record<string, { label: string; color: string }> = {
  instagram: { label: "Instagram", color: "border-pink-500/40 bg-pink-500/10 text-pink-700 dark:text-pink-300" },
  facebook: { label: "Facebook", color: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300" },
  linkedin: { label: "LinkedIn", color: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300" },
  gmn: { label: "Google Meu Negócio", color: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300" },
};

export function ApprovalClient({ token, post }: { token: string; post: PostData }) {
  const [acao, setAcao] = useState<"aprovar" | "ajuste" | null>(null);
  const [email, setEmail] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<"aprovado" | "ajustes_solicitados" | null>(
    post.status === "aprovado" ? "aprovado" :
    post.status === "ajustes_solicitados" ? "ajustes_solicitados" :
    null,
  );

  const jaRespondido = success !== null;
  const [activeIndex, setActiveIndex] = useState(0);
  const cover = post.midias[activeIndex] ?? post.midias[0];
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
      const r = await respondToSocialApprovalAction(fd);
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
        <header className="text-center space-y-2">
          {post.organization_nome && (
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              {post.organization_nome}
            </p>
          )}
          <h1 className="text-2xl font-bold tracking-tight">
            Aprovação de post
          </h1>
          <p className="text-sm text-muted-foreground">
            Cliente: <strong className="text-foreground">{post.client_nome}</strong>
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
                <img src={cover} alt={post.titulo ?? "Post"} className="h-full w-full object-contain" />
              )
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <ImageLucide className="h-10 w-10" />
              </div>
            )}
          </div>

          {/* Thumbnails se carrossel */}
          {post.midias.length > 1 && (
            <div className="flex gap-2 overflow-x-auto p-3 border-t bg-muted/20">
              {post.midias.map((url, i) => {
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
            <div className="flex flex-wrap items-center gap-1.5">
              {post.titulo && (
                <h2 className="font-semibold text-lg flex-1 min-w-0">{post.titulo}</h2>
              )}
              <span className="rounded-full border bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {FORMATO_LABEL[post.formato] ?? post.formato}
              </span>
            </div>

            {/* Redes */}
            {post.redes.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <span className="text-[11px] text-muted-foreground self-center">Vai publicar em:</span>
                {post.redes.map((r) => {
                  const def = REDE_LABEL[r];
                  if (!def) return null;
                  return (
                    <span
                      key={r}
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${def.color}`}
                    >
                      {def.label}
                    </span>
                  );
                })}
              </div>
            )}

            {post.agendar_para && (
              <p className="text-[11px] text-muted-foreground">
                <CalendarIcon className="inline h-3 w-3 mr-1" />
                Agendado pra <strong className="text-foreground">{new Date(post.agendar_para).toLocaleString("pt-BR")}</strong>
              </p>
            )}

            {post.legenda && (
              <div className="rounded-md border bg-muted/20 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  <MessageSquare className="inline h-3 w-3 mr-1" /> Legenda do post
                </p>
                <p className="text-sm whitespace-pre-wrap text-foreground/90">
                  {post.legenda}
                </p>
                {post.hashtags && (
                  <p className="text-xs text-muted-foreground mt-2 italic">{post.hashtags}</p>
                )}
              </div>
            )}

            {post.primeiro_comentario && (
              <details className="rounded-md border bg-muted/10 px-3 py-2">
                <summary className="cursor-pointer text-[11px] font-semibold text-muted-foreground">
                  💬 Primeiro comentário (após publicar)
                </summary>
                <p className="text-xs whitespace-pre-wrap text-foreground/80 mt-2">
                  {post.primeiro_comentario}
                </p>
              </details>
            )}
          </div>
        </div>

        {/* Status anterior */}
        {post.ajuste_observacoes && post.status === "ajustes_solicitados" && !success && (
          <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-3">
            <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">
              Você havia pedido os seguintes ajustes:
            </p>
            <p className="text-xs text-foreground/80 mt-1">{post.ajuste_observacoes}</p>
          </div>
        )}

        {/* Estado pós-resposta */}
        {success === "aprovado" && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-6 text-center space-y-2">
            <Check className="h-12 w-12 mx-auto text-emerald-600" />
            <h2 className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">
              Post aprovado!
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
                      placeholder="Ex.: Mudar a legenda pra ficar menos formal, trocar a primeira imagem do carrossel, ajustar as hashtags..."
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
