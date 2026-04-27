"use client";

import Link from "next/link";
import { markNotificationReadAction } from "@/lib/notificacoes/actions";

interface Props {
  id: string;
  titulo: string;
  mensagem: string;
  link: string | null;
  lida: boolean;
  created_at: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function NotificationItem({ id, titulo, mensagem, link, lida, created_at }: Props) {
  async function markRead() {
    if (lida) return;
    const fd = new FormData();
    fd.set("id", id);
    await markNotificationReadAction(fd);
  }

  const content = (
    <div className={`flex items-start gap-2 rounded-md p-2 ${lida ? "" : "bg-primary/5"}`}>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate">{titulo}</div>
        <div className="text-[11px] text-muted-foreground line-clamp-2">{mensagem}</div>
      </div>
      <span className="text-[10px] text-muted-foreground whitespace-nowrap">{timeAgo(created_at)}</span>
    </div>
  );

  if (link) {
    return (
      <Link href={link} onClick={markRead} className="block">
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={markRead} className="block w-full text-left">
      {content}
    </button>
  );
}
