"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MessageCircle, Lock, Loader2, ExternalLink, SendHorizontal } from "lucide-react";
import { ChatHeader } from "./ChatHeader";
import { MessageBubble } from "./MessageBubble";
import type { WppConversation, WppMessage } from "@/lib/conversas/types";
import { responderConversaAction } from "@/lib/conversas/actions";
import { janelaFechada } from "@/lib/conversas/janela";
import { APP_TIMEZONE, getTodayDate } from "@/lib/datetime/timezone";

interface Props {
  conversa: WppConversation | null;
  initialMessages?: WppMessage[];
}

function agruparPorDia(mensagens: WppMessage[]): Array<{ dia: string; rotulo: string; itens: WppMessage[] }> {
  const grupos = new Map<string, WppMessage[]>();
  for (const m of mensagens) {
    const dia = m.created_at.slice(0, 10);
    const cur = grupos.get(dia) ?? [];
    cur.push(m);
    grupos.set(dia, cur);
  }
  const hoje = getTodayDate();
  const ontem = getTodayDate(new Date(Date.now() - 86400000));

  return [...grupos.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dia, itens]) => {
      let rotulo: string;
      if (dia === hoje) rotulo = "Hoje";
      else if (dia === ontem) rotulo = "Ontem";
      else {
        const d = new Date(`${dia}T12:00:00`);
        const diffDias = (Date.now() - d.getTime()) / 86400000;
        rotulo = diffDias < 7
          ? d.toLocaleDateString("pt-BR", { timeZone: APP_TIMEZONE, weekday: "long" })
          : d.toLocaleDateString("pt-BR", { timeZone: APP_TIMEZONE, day: "2-digit", month: "long", year: "numeric" });
      }
      return { dia, rotulo, itens };
    });
}

const WALLPAPER_CLASSES =
  "bg-[radial-gradient(circle_at_top_left,theme(colors.emerald.500/0.04),transparent_40%),radial-gradient(circle_at_bottom_right,theme(colors.teal.500/0.04),transparent_40%)]";

export function ChatView({ conversa, initialMessages }: Props) {
  const [messages, setMessages] = useState<WppMessage[]>(initialMessages ?? []);
  const [loading, setLoading] = useState(!initialMessages && !!conversa);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!conversa) return;
    if (!initialMessages) {
      fetch(`/api/conversas/messages?conversationId=${conversa.id}`)
        .then((r) => r.json())
        .then((data) => setMessages(data as WppMessage[]))
        .catch(() => setMessages([]))
        .finally(() => setLoading(false));
    }
  }, [conversa?.id, initialMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const recarregar = useCallback(async () => {
    if (!conversa) return;
    try {
      const r = await fetch(`/api/conversas/messages?conversationId=${conversa.id}`);
      if (r.ok) setMessages((await r.json()) as WppMessage[]);
    } catch {}
  }, [conversa?.id]);

  // Poll for new messages every 5s
  useEffect(() => {
    if (!conversa) return;
    const interval = setInterval(recarregar, 5000);
    return () => clearInterval(interval);
  }, [conversa?.id, recarregar]);

  if (!conversa) {
    return (
      <div className={`flex h-full flex-1 flex-col items-center justify-center gap-4 ${WALLPAPER_CLASSES} bg-muted/20`}>
        <div className="rounded-full bg-emerald-500/10 p-8">
          <MessageCircle className="h-16 w-16 text-emerald-500/60" />
        </div>
        <div className="max-w-md text-center space-y-2 px-6">
          <h2 className="text-xl font-light tracking-tight">Conversas Yide</h2>
          <p className="text-sm text-muted-foreground">
            Espelho do WhatsApp da agência no Lyide. Selecione uma conversa à esquerda.
          </p>
        </div>
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Lock className="h-3 w-3" />
          Responda com texto aqui. Modelos e mídia, pelo Lyide.
        </p>
      </div>
    );
  }

  const grupos = agruparPorDia(messages);

  return (
    <div className={`flex h-full flex-1 flex-col ${WALLPAPER_CLASSES}`}>
      <ChatHeader conversa={conversa} />

      <div className="flex-1 space-y-4 overflow-y-auto px-3 py-4 sm:px-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Nenhuma mensagem nessa conversa ainda.
          </p>
        ) : (
          grupos.map((g) => (
            <div key={g.dia} className="space-y-2">
              <div className="flex justify-center">
                <span className="rounded-full bg-card/80 backdrop-blur-sm px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground shadow-sm">
                  {g.rotulo}
                </span>
              </div>
              {g.itens.map((m) => (
                <MessageBubble key={m.id} mensagem={m} />
              ))}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <Composer
        conversaId={conversa.id}
        lyideUrl={conversa.lyide_url ?? null}
        fechada={!loading && messages.length > 0 && janelaFechada(messages)}
        onEnviada={recarregar}
      />
    </div>
  );
}

function Composer({
  conversaId,
  lyideUrl,
  fechada,
  onEnviada,
}: {
  conversaId: string;
  lyideUrl: string | null;
  fechada: boolean;
  onEnviada: () => Promise<void>;
}) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // O Lyide pode recusar mesmo com a janela parecendo aberta aqui.
  const [fechadaNoEnvio, setFechadaNoEnvio] = useState(false);
  const bloqueada = fechada || fechadaNoEnvio;

  const enviar = async () => {
    const t = texto.trim();
    if (!t || enviando || bloqueada) return;
    setEnviando(true);
    setErro(null);
    try {
      const r = await responderConversaAction(conversaId, t);
      if (r.ok) {
        setTexto("");
        await onEnviada();
      } else {
        if (r.janelaFechada) setFechadaNoEnvio(true);
        setErro(r.erro);
      }
    } catch {
      setErro("Não foi possível enviar agora. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  };

  const linkLyide = lyideUrl ? (
    <a
      href={lyideUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-medium text-emerald-700 hover:underline dark:text-emerald-400"
    >
      <ExternalLink className="h-3 w-3" />
      Abrir no Lyide
    </a>
  ) : null;

  if (bloqueada) {
    return (
      <div className="border-t bg-card px-3 py-3 text-center text-xs text-muted-foreground">
        <p>
          Janela de 24h fechada: o cliente não escreve há mais de 24h, então só dá pra enviar modelo aprovado.
        </p>
        {linkLyide ? <p className="mt-1.5">{linkLyide} para enviar um modelo.</p> : null}
      </div>
    );
  }

  return (
    <div className="border-t bg-card px-3 py-2.5">
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void enviar();
        }}
      >
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void enviar();
            }
          }}
          rows={1}
          maxLength={4000}
          placeholder="Digite uma mensagem"
          aria-label="Mensagem"
          disabled={enviando}
          className="max-h-32 min-h-[40px] flex-1 resize-none rounded-2xl border bg-background px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={enviando || !texto.trim()}
          aria-label="Enviar"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
        </button>
      </form>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-muted-foreground">
        {erro ? <span className="text-red-600 dark:text-red-400">{erro}</span> : <span>Modelos e mídia, pelo Lyide.</span>}
        {linkLyide}
      </div>
    </div>
  );
}
