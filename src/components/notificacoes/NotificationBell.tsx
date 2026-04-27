"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationItem } from "./NotificationItem";
import { getMyNotificationsAction, markAllNotificationsReadAction } from "@/lib/notificacoes/actions";

interface Item {
  id: string;
  titulo: string;
  mensagem: string;
  link: string | null;
  lida: boolean;
  created_at: string;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<Item[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  async function fetchData() {
    try {
      const data = await getMyNotificationsAction();
      setItems(data.items);
      setUnread(data.unread);
    } catch {
      // silencioso — falha de fetch não deve quebrar UI
    }
  }

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60_000);
    const onFocus = () => fetchData();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function handleMarkAll() {
    await markAllNotificationsReadAction();
    await fetchData();
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Notificações"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded-lg border bg-popover p-2 shadow-lg">
          <div className="flex items-center justify-between border-b pb-2">
            <span className="text-xs font-semibold">Notificações</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                className="text-[11px] text-primary hover:underline"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          <div className="mt-2 max-h-80 space-y-1 overflow-y-auto">
            {items.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">Sem notificações</div>
            ) : (
              items.map((it) => (
                <NotificationItem key={it.id} {...it} />
              ))
            )}
          </div>

          <div className="border-t pt-2">
            <Link
              href="/notificacoes"
              onClick={() => setOpen(false)}
              className="block text-center text-[11px] text-primary hover:underline"
            >
              Ver todas
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
