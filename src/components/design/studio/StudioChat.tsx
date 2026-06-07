// src/components/design/studio/StudioChat.tsx
"use client";

import { useRef, useState, useTransition, useCallback } from "react";
import { Send, Bot, User, Loader2 } from "lucide-react";
import { chatStudioAction, type ChatMsg } from "@/lib/design/chat-actions";
import type { Comando } from "@/lib/design/studio-comandos";
import type { Composicao } from "@/lib/design/studio-tipos";

interface Props {
  clientId: string;
  composicao: Composicao;
  logoUrl: string | null;
  aplicarIA: (comandos: Comando[], logoUrl: string | null) => void;
  onGerarImagem: (prompt: string, alvo: "fundo" | "camada") => Promise<string | null>;
  gerando: boolean;
  onAplicado: () => void; // troca pra aba Editor
}

const PILLS = [
  "Crie um post de promoção com fundo chamativo",
  "Arte institucional profissional",
  "Post de aniversário festivo",
  "Anúncio de evento com data e local",
];

type LocalMsg = { id: number; msg: ChatMsg };

export function StudioChat({ clientId, composicao, logoUrl, aplicarIA, onGerarImagem, gerando, onAplicado }: Props) {
  const [localMsgs, setLocalMsgs] = useState<LocalMsg[]>([]);
  const [texto, setTexto] = useState("");
  const [pending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);

  const nextId = useCallback(() => { idRef.current += 1; return idRef.current; }, []);

  function scrollFim() {
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
  }

  function enviar(msg: string) {
    const mensagem = msg.trim();
    if (!mensagem || pending || gerando) return;
    setTexto("");
    const userEntry: LocalMsg = { id: nextId(), msg: { role: "user", content: mensagem } };
    const novoLocal = [...localMsgs, userEntry];
    setLocalMsgs(novoLocal);
    scrollFim();

    // Build ChatMsg[] history for the server action
    const historico: ChatMsg[] = novoLocal.map((e) => e.msg);

    startTransition(async () => {
      const r = await chatStudioAction(clientId, historico.slice(0, -1), mensagem, composicao);
      if ("error" in r) {
        setLocalMsgs([...novoLocal, { id: nextId(), msg: { role: "assistant", content: `⚠️ ${r.error}` } }]);
        scrollFim();
        return;
      }
      setLocalMsgs([...novoLocal, { id: nextId(), msg: { role: "assistant", content: r.mensagem } }]);
      if (r.comandos.length > 0) {
        const gerar = r.comandos.filter((c) => c.action === "gerarImagem");
        const resto = r.comandos.filter((c) => c.action !== "gerarImagem");
        for (const g of gerar) {
          const alvo = (g.alvo === "camada" ? "camada" : "fundo") as "fundo" | "camada";
          const url = await onGerarImagem(String(g.prompt), alvo);
          if (!url) {
            setLocalMsgs((m) => [
              ...m,
              {
                id: nextId(),
                msg: {
                  role: "assistant",
                  content: "⚠️ Não consegui gerar a imagem. Verifique a configuração (OPENAI_API_KEY) ou tente outro pedido.",
                },
              },
            ]);
          }
        }
        if (resto.length > 0) aplicarIA(resto, logoUrl);
        onAplicado();
      }
      scrollFim();
    });
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        <div className="flex gap-2">
          <Avatar role="assistant" />
          <div className="max-w-[85%] space-y-2">
            <Bubble role="assistant">
              Olá! Sou a IA do Studio. Descreva a arte que você quer e eu monto os elementos na canvas
              seguindo o manual da marca deste cliente.
            </Bubble>
            <div className="flex flex-wrap gap-1.5">
              {PILLS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => enviar(p)}
                  disabled={pending || gerando}
                  className="rounded-full border bg-card px-2.5 py-1 text-[11px] hover:border-primary hover:text-primary disabled:opacity-50"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {localMsgs.map(({ id, msg: m }) => (
          <div key={id} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <Avatar role={m.role} />
            <Bubble role={m.role}>{m.content}</Bubble>
          </div>
        ))}

        {pending && !gerando && (
          <div className="flex gap-2">
            <Avatar role="assistant" />
            <Bubble role="assistant">…</Bubble>
          </div>
        )}

        {gerando && (
          <div className="flex gap-2">
            <Avatar role="assistant" />
            <Bubble role="assistant">
              <span className="flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                gerando imagem…
              </span>
            </Bubble>
          </div>
        )}
      </div>

      <div className="border-t p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviar(texto);
              }
            }}
            rows={1}
            placeholder="Descreva a arte que você quer criar…"
            className="max-h-32 min-h-[42px] flex-1 resize-none rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={() => enviar(texto)}
            disabled={pending || gerando || !texto.trim()}
            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          A IA monta os elementos na canvas automaticamente.
        </p>
      </div>
    </div>
  );
}

function Avatar({ role }: { role: ChatMsg["role"] }) {
  return (
    <div
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
        role === "user" ? "bg-primary text-primary-foreground" : "border bg-card"
      }`}
    >
      {role === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
    </div>
  );
}

function Bubble({ role, children }: { role: ChatMsg["role"]; children: React.ReactNode }) {
  return (
    <div
      className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm leading-relaxed ${
        role === "user" ? "bg-primary text-primary-foreground" : "border bg-card"
      }`}
    >
      {children}
    </div>
  );
}
