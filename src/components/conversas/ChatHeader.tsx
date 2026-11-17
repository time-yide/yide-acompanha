import Link from "next/link";
import { ArrowLeft, Bot, ExternalLink } from "lucide-react";
import { Avatar } from "./Avatar";
import type { WppConversation } from "@/lib/conversas/types";

interface Props {
  conversa: WppConversation;
}

export function ChatHeader({ conversa }: Props) {
  return (
    <header className="flex items-center justify-between gap-2 border-b bg-card px-3 py-2.5">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Link
          href="/conversas"
          scroll={false}
          className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
          aria-label="Voltar pra lista"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <Avatar nome={conversa.contato_nome || conversa.contato_telefone} avatarUrl={conversa.avatar_url} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {conversa.contato_nome || conversa.contato_telefone}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {conversa.contato_telefone}
            {conversa.lead_nome ? ` · ${conversa.lead_nome}` : ""}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
            conversa.ai_ativa
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
              : "bg-muted text-muted-foreground"
          }`}
        >
          <Bot className="h-3 w-3" />
          {conversa.ai_ativa ? "IA ativa" : "IA pausada"}
        </span>
      </div>
      {conversa.lyide_url && (
        <a
          href={conversa.lyide_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Abrir no Lyide</span>
        </a>
      )}
    </header>
  );
}
