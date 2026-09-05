import Link from "next/link";
import { Pin } from "lucide-react";
import { Avatar } from "./Avatar";
import { formatHora } from "@/lib/conversas/helpers";
import type { WppConversation } from "@/lib/conversas/types";

interface Props {
  conversa: WppConversation;
  selecionada: boolean;
}

export function ConversaItem({ conversa, selecionada }: Props) {
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
      <Avatar nome={conversa.contato_nome || conversa.contato_telefone} />

      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium text-foreground">
            {conversa.contato_nome || conversa.contato_telefone}
          </p>
          <span
            className={`shrink-0 text-[11px] ${
              conversa.nao_lidas > 0
                ? "font-medium text-emerald-600 dark:text-emerald-400"
                : "text-muted-foreground"
            }`}
          >
            {conversa.ultima_msg_em ? formatHora(conversa.ultima_msg_em) : ""}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-xs text-muted-foreground">
            {conversa.ultimo_texto ?? ""}
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
