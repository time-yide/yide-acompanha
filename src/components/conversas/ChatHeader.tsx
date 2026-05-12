import Link from "next/link";
import { Phone, Video, MoreVertical, Search, ArrowLeft, AtSign } from "lucide-react";
import { Avatar } from "./Avatar";
import { formatHoraMsg, type ConversaMock } from "@/lib/conversas/mock-data";
import { APP_TIMEZONE } from "@/lib/datetime/timezone";

interface Props {
  conversa: ConversaMock;
}

function statusLabel(c: ConversaMock): string {
  if (c.online) return "online";
  if (c.ultima_vez_visto) {
    const d = new Date(c.ultima_vez_visto);
    const agora = new Date();
    const diffMin = (agora.getTime() - d.getTime()) / 60000;
    if (diffMin < 60) return `visto há ${Math.floor(diffMin)} min`;
    if (agora.toDateString() === d.toDateString()) {
      return `visto hoje às ${formatHoraMsg(c.ultima_vez_visto)}`;
    }
    return `visto em ${d.toLocaleDateString("pt-BR", { timeZone: APP_TIMEZONE, day: "2-digit", month: "2-digit" })}`;
  }
  return "offline";
}

/**
 * Header da conversa selecionada: avatar + nome + status + ações.
 */
export function ChatHeader({ conversa }: Props) {
  return (
    <header className="flex items-center justify-between gap-2 border-b bg-card px-3 py-2.5">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {/* Botão "voltar" só aparece em mobile (sidebar fechada) */}
        <Link
          href="/conversas"
          scroll={false}
          className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
          aria-label="Voltar pra lista"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <Avatar nome={conversa.contato_nome} avatarUrl={conversa.avatar_url} online={conversa.online} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium flex items-center gap-1.5">
            {conversa.canal === "instagram" && (
              <AtSign className="h-3.5 w-3.5 shrink-0 text-pink-500" />
            )}
            {conversa.contato_nome}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {statusLabel(conversa)} · {conversa.instancia_nome}
          </p>
        </div>
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
