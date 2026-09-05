"use client";

import { useState } from "react";
import { Paperclip, Smile, Mic, Send, Loader2 } from "lucide-react";

interface Props {
  onSend?: (texto: string) => void;
  sending?: boolean;
}

export function ChatInput({ onSend, sending }: Props) {
  const [texto, setTexto] = useState("");

  function handleSend() {
    if (!texto.trim() || sending) return;
    if (onSend) {
      onSend(texto);
      setTexto("");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="border-t bg-card">
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
          disabled={sending}
          className="max-h-32 min-h-10 flex-1 resize-none rounded-2xl bg-muted/60 px-4 py-2 text-sm outline-none placeholder:text-muted-foreground focus:bg-muted disabled:opacity-50"
        />
        {texto.trim() ? (
          <button
            type="button"
            onClick={handleSend}
            disabled={sending}
            className="rounded-full bg-emerald-500 p-2 text-white hover:bg-emerald-600 disabled:opacity-50"
            aria-label="Enviar"
          >
            {sending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
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
