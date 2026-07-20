"use client";

import { useRef, useState, useTransition } from "react";
import { Paperclip, Send, X, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { sendChatMessageAction, prepareChatAttachmentUpload } from "@/lib/escritorio/actions";
import { createClient } from "@/lib/supabase/client";
import type { ChatMessage } from "@/lib/escritorio/types";

interface Mentionable {
  id: string;
  nome: string;
  role: string;
}

interface CurrentUser {
  id: string;
  nome: string;
  avatar_url: string | null;
}

interface Props {
  channelId: string;
  mentionables: Mentionable[];
  replyTo: ChatMessage | null;
  onClearReply: () => void;
  currentUser: CurrentUser;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

const MAX_ATTACHMENTS = 5;

export function MessageInput({ channelId, mentionables, replyTo, onClearReply, currentUser, setMessages }: Props) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [uploading, startUpload] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Mention autocomplete: detecta "@xxx" próximo ao cursor
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState<number | null>(null);

  function onTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setText(value);

    const cursor = e.target.selectionStart ?? value.length;
    // Procura "@" antes do cursor sem espaço entre
    const before = value.slice(0, cursor);
    const atIndex = before.lastIndexOf("@");
    if (atIndex >= 0) {
      const between = before.slice(atIndex + 1);
      // Mention só funciona se "@" tá no início ou após espaço/quebra de linha
      const charBefore = atIndex === 0 ? " " : before.charAt(atIndex - 1);
      if (/\s/.test(charBefore) || atIndex === 0) {
        if (!/\s/.test(between)) {
          setMentionQuery(between.toLowerCase());
          setMentionStart(atIndex);
          return;
        }
      }
    }
    setMentionQuery(null);
    setMentionStart(null);
  }

  function pickMention(m: Mentionable) {
    if (mentionStart === null) return;
    const before = text.slice(0, mentionStart);
    const after = text.slice((textareaRef.current?.selectionStart ?? text.length));
    const handle = m.nome.split(/\s+/)[0]; // primeiro nome como handle
    const next = `${before}@${handle} ${after}`;
    setText(next);
    setMentionQuery(null);
    setMentionStart(null);
    // Foca de volta no textarea
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  // Mapeia handles "@nome" → mentioned_user_ids resolvidos a partir de mentionables
  function resolveMentionedIds(content: string): string[] {
    const ids: string[] = [];
    const matches = content.match(/@[\w.\-áéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ]+/g) ?? [];
    for (const raw of matches) {
      const handle = raw.slice(1).toLowerCase();
      // Match contra primeiro nome
      const m = mentionables.find(
        (x) => x.nome.split(/\s+/)[0].toLowerCase() === handle,
      );
      if (m && !ids.includes(m.id)) ids.push(m.id);
    }
    return ids;
  }

  function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    if (attachments.length + files.length > MAX_ATTACHMENTS) {
      toast.error(`Máx. ${MAX_ATTACHMENTS} anexos por mensagem`);
      return;
    }
    e.target.value = "";

    startUpload(async () => {
      const supabase = createClient();
      for (const file of files) {
        // 1) prepara (só gera o token — arquivo não passa pelo Server Action)
        const prep = await prepareChatAttachmentUpload(file.name, file.type, file.size);
        if ("error" in prep) {
          toast.error(prep.error);
          return;
        }
        // 2) sobe os bytes direto pro Storage (fura o limite de 2MB)
        const { error: upErr } = await supabase.storage
          .from("chat-attachments")
          .uploadToSignedUrl(prep.path, prep.token, file, { contentType: file.type });
        if (upErr) {
          toast.error(`Falha no upload: ${upErr.message}`);
          return;
        }
        setAttachments((prev) => [...prev, prep.url]);
      }
    });
  }

  function removeAttachment(url: string) {
    setAttachments((prev) => prev.filter((u) => u !== url));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;

    const mentioned = resolveMentionedIds(trimmed);

    // Snapshot dos valores antes de limpar (pra construir a msg otimista)
    const sentAttachments = [...attachments];
    const sentReplyTo = replyTo;

    // Gera o UUID REAL no client e manda pro server inserir com ele. Assim a
    // msg otimista, o insert e o evento realtime compartilham o MESMO id — a
    // dedup por id funciona e não duplica no envio. `pending` mostra o relógio
    // até o server confirmar (aí vira check).
    const msgId = crypto.randomUUID();
    const optimisticMsg: ChatMessage = {
      id: msgId,
      pending: true,
      channel_id: channelId,
      autor_id: currentUser.id,
      conteudo: trimmed,
      reply_to_id: sentReplyTo?.id ?? null,
      attachment_urls: sentAttachments,
      mentioned_user_ids: mentioned,
      created_at: new Date().toISOString(),
      updated_at: null,
      autor: { id: currentUser.id, nome: currentUser.nome, avatar_url: currentUser.avatar_url },
      reply_to: sentReplyTo
        ? { id: sentReplyTo.id, conteudo: sentReplyTo.conteudo, autor_nome: sentReplyTo.autor?.nome ?? null }
        : null,
    };

    // 1. Insere otimisticamente - UI atualiza imediato.
    setMessages((prev) => [...prev, optimisticMsg]);
    setText("");
    setAttachments([]);
    onClearReply();

    const fd = new FormData();
    fd.set("id", msgId);
    fd.set("channel_id", channelId);
    fd.set("conteudo", trimmed);
    if (sentReplyTo) fd.set("reply_to_id", sentReplyTo.id);
    fd.set("attachment_urls", JSON.stringify(sentAttachments));
    fd.set("mentioned_user_ids", JSON.stringify(mentioned));

    startTransition(async () => {
      const r = await sendChatMessageAction(undefined, fd);
      if (r?.error) {
        // Remove a otimista e devolve o texto pro user tentar de novo.
        setMessages((prev) => prev.filter((m) => m.id !== msgId));
        setText(trimmed);
        setAttachments(sentAttachments);
        toast.error(r.error);
        return;
      }
      // Confirmado: tira o `pending` (relógio → check) e alinha o created_at
      // com o do server. O id já é o real, então não há troca de id nem risco
      // de duplicar com o evento realtime (dedup por id cobre).
      const realCreatedAt = r?.created_at ?? optimisticMsg.created_at;
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, pending: false, created_at: realCreatedAt } : m)),
      );
    });
  }

  function isImage(url: string): boolean {
    return /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url);
  }

  const filteredMentions =
    mentionQuery === null
      ? []
      : mentionables
          .filter((m) =>
            m.nome.toLowerCase().includes(mentionQuery)
          )
          .slice(0, 8);

  return (
    <div className="space-y-2 rounded-xl border bg-card p-3">
      {replyTo && (
        <div className="flex items-start justify-between gap-2 rounded-md border-l-2 border-primary/50 bg-muted/30 px-2 py-1.5 text-xs">
          <div className="min-w-0">
            <p className="font-medium text-muted-foreground">Respondendo a {replyTo.autor?.nome ?? ""}</p>
            <p className="line-clamp-2 text-muted-foreground/80">{replyTo.conteudo}</p>
          </div>
          <button type="button" onClick={onClearReply} className="rounded-full p-1 text-muted-foreground hover:bg-muted">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((url) => (
            <div key={url} className="group relative h-16 w-16 overflow-hidden rounded-md border bg-muted">
              {isImage(url) ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <FileText className="h-4 w-4" />
                </div>
              )}
              <button
                type="button"
                onClick={() => removeAttachment(url)}
                className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Remover"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="relative space-y-2">
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={onTextChange}
          placeholder="Escreva uma mensagem... (use @nome pra mencionar)"
          rows={2}
          maxLength={4000}
          className="resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />

        {filteredMentions.length > 0 && (
          <div className="absolute bottom-full mb-1 z-10 max-h-48 w-72 overflow-y-auto rounded-md border bg-popover p-1 shadow-lg">
            {filteredMentions.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => pickMention(m)}
                className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
              >
                <span className="font-medium">{m.nome}</span>
                <span className="text-xs text-muted-foreground">{m.role}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-xs text-muted-foreground hover:bg-muted">
            <Paperclip className="h-3.5 w-3.5" />
            {uploading ? "Enviando..." : "Anexar"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
              multiple
              onChange={onUpload}
              disabled={uploading || pending}
              className="hidden"
            />
          </label>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">{text.length}/4000</span>
            <Button type="submit" size="sm" disabled={pending || (!text.trim() && attachments.length === 0)}>
              <Send className="mr-1 h-3.5 w-3.5" />
              {pending ? "Enviando..." : "Enviar"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
