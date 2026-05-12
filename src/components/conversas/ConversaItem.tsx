import Link from "next/link";
import { Pin, Check, CheckCheck, AtSign } from "lucide-react";
import { Avatar } from "./Avatar";
import { formatHora, type ConversaMock } from "@/lib/conversas/mock-data";

interface Props {
  conversa: ConversaMock;
  selecionada: boolean;
}

/**
 * Linha de uma conversa na sidebar — avatar, nome, prévia, hora, badge unread.
 * Navega via Link (?c=ID) pra manter Server Component.
 */
export function ConversaItem({ conversa, selecionada }: Props) {
  const ultima = conversa.mensagens[conversa.mensagens.length - 1];
  const eMinha = ultima?.autor === "comercial";
  const preview = conversa.ultima_mensagem;

  return (
    <Link
      href={`/conversas?c=${conversa.id}`}
      scroll={false}
      className={`group flex items-center gap-3 px-3 py-3 transition-colors ${
        selecionada
          ? "bg-muted/60"
          : "hover:bg-muted/40"
      }`}
    >
      <Avatar nome={conversa.contato_nome} avatarUrl={conversa.avatar_url} online={conversa.online} />

      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium text-foreground flex items-center gap-1.5">
            {conversa.canal === "instagram" && (
              <AtSign className="h-3 w-3 shrink-0 text-pink-500" />
            )}
            {conversa.contato_nome}
          </p>
          <span
            className={`shrink-0 text-[11px] ${
              conversa.nao_lidas > 0
                ? "font-medium text-emerald-600 dark:text-emerald-400"
                : "text-muted-foreground"
            }`}
          >
            {formatHora(conversa.ultima_mensagem_em)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-xs text-muted-foreground flex items-center gap-1">
            {eMinha && (
              <span className="shrink-0">
                {ultima.status === "lida" ? (
                  <CheckCheck className="h-3.5 w-3.5 text-sky-500" />
                ) : ultima.status === "entregue" ? (
                  <CheckCheck className="h-3.5 w-3.5" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
              </span>
            )}
            <span className="truncate">{preview}</span>
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            {conversa.fixada && (
              <Pin className="h-3 w-3 text-muted-foreground" />
            )}
            {conversa.nao_lidas > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[11px] font-semibold text-white">
                {conversa.nao_lidas}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
