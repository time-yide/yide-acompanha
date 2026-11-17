"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Pin } from "lucide-react";
import { Avatar } from "./Avatar";
import { formatHora } from "@/lib/conversas/helpers";
import type { WppConversation } from "@/lib/conversas/types";
import { marcarConversaVista, useConversaVista } from "@/lib/conversas/vistas";

interface Props {
  conversa: WppConversation;
  selecionada: boolean;
}

export function ConversaItem({ conversa, selecionada }: Props) {
  const vista = useConversaVista(conversa.id, conversa.ultima_msg_em);
  const aguardando = conversa.nao_lidas > 0 && !vista;

  // Conversa aberta (clique ou link direto) = vista: some a bolinha.
  useEffect(() => {
    if (selecionada) marcarConversaVista(conversa.id, conversa.ultima_msg_em);
  }, [selecionada, conversa.id, conversa.ultima_msg_em]);

  return (
    <Link
      href={`/conversas?c=${conversa.id}`}
      scroll={false}
      onClick={() => marcarConversaVista(conversa.id, conversa.ultima_msg_em)}
      className={`group flex items-center gap-3 px-3 py-3 transition-colors ${
        selecionada
          ? "bg-muted/60"
          : "hover:bg-muted/40"
      }`}
    >
      <Avatar nome={conversa.contato_nome || conversa.contato_telefone} avatarUrl={conversa.avatar_url} />

      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium text-foreground">
            {conversa.contato_nome || conversa.contato_telefone}
          </p>
          <span
            className={`shrink-0 text-[11px] ${
              aguardando
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
            {aguardando && (
              <span
                className="h-2.5 w-2.5 rounded-full bg-emerald-500"
                aria-label="Aguardando resposta"
                title="Aguardando resposta"
              />
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
