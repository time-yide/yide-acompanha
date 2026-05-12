"use client";

import { useState } from "react";
import { Paperclip, Smile, Mic, Send } from "lucide-react";

interface Props {
  /** Cb que recebe o texto digitado quando user clica em enviar (placeholder por enquanto). */
  onSend?: (texto: string) => void;
}

/**
 * Barra de input estilo WhatsApp: emoji + anexo + textarea + (mic | send).
 * Comportamento "real" — texto fica preso enquanto Evolution API não tá
 * conectada. Click no enviar mostra toast "Em construção".
 */
export function ChatInput({ onSend }: Props) {
  const [texto, setTexto] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);

  function handleSend() {
    if (!texto.trim()) return;
    if (onSend) {
      onSend(texto);
      setTexto("");
      return;
    }
    setAviso("Conexão com WhatsApp ainda em construção. Sua mensagem não foi enviada.");
    setTimeout(() => setAviso(null), 3500);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="border-t bg-card">
      {aviso && (
        <div className="bg-amber-500/10 px-4 py-1.5 text-center text-[11px] text-amber-700 dark:text-amber-300">
          {aviso}
        </div>
      )}
      <div className="flex items-end gap-2 px-3 py-2.5">
        <button
          type="button"
          className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Emoji"
          title="Em breve"
        >
          <Smile className="h-5 w-5" />
        </button>
        <button
          type="button"
          className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Anexo"
          title="Em breve"
        >
          <Paperclip className="h-5 w-5" />
        </button>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite uma mensagem"
          rows={1}
          className="max-h-32 min-h-10 flex-1 resize-none rounded-2xl bg-muted/60 px-4 py-2 text-sm outline-none placeholder:text-muted-foreground focus:bg-muted"
        />
        {texto.trim() ? (
          <button
            type="button"
            onClick={handleSend}
            className="rounded-full bg-emerald-500 p-2 text-white hover:bg-emerald-600"
            aria-label="Enviar"
          >
            <Send className="h-5 w-5" />
          </button>
        ) : (
          <button
            type="button"
            className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Gravar áudio"
            title="Em breve"
          >
            <Mic className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}
