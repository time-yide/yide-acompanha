import Link from "next/link";
import { Phone, Video, MoreVertical, Search, ArrowLeft } from "lucide-react";
import { Avatar } from "./Avatar";
import { BadgeIAAtiva } from "./BadgeIAAtiva";
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
        <Avatar nome={conversa.contato_nome || conversa.contato_telefone} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {conversa.contato_nome || conversa.contato_telefone}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {conversa.contato_telefone}
            {conversa.lead_nome ? ` · ${conversa.lead_nome}` : ""}
          </p>
        </div>
        <BadgeIAAtiva conversationId={conversa.id} aiAtiva={conversa.ai_ativa ?? false} />
      </div>
      <div className="flex items-center gap-1 text-muted-foreground shrink-0">
        <button
          type="button"
          className="rounded-full p-1.5 hover:bg-muted hover:text-foreground"
          aria-label="Chamada de vídeo"
          title="Em breve"
        >
          <Video className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="rounded-full p-1.5 hover:bg-muted hover:text-foreground"
          aria-label="Ligar"
          title="Em breve"
        >
          <Phone className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="rounded-full p-1.5 hover:bg-muted hover:text-foreground"
          aria-label="Buscar"
          title="Em breve"
        >
          <Search className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="rounded-full p-1.5 hover:bg-muted hover:text-foreground"
          aria-label="Mais opções"
          title="Em breve"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
