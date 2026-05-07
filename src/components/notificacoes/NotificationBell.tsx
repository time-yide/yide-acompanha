"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationItem } from "./NotificationItem";
import { getMyNotificationsAction, markAllNotificationsReadAction } from "@/lib/notificacoes/actions";
import { createClient } from "@/lib/supabase/client";
import { authenticateRealtime } from "@/lib/supabase/realtime-auth";

interface Item {
  id: string;
  titulo: string;
  mensagem: string;
  link: string | null;
  lida: boolean;
  created_at: string;
}

interface Props {
  /** ID do user atual — usado pra filtrar a subscription do Realtime. */
  userId: string;
}

export function NotificationBell({ userId }: Props) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<Item[]>([]);
  const [markingAll, setMarkingAll] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    try {
      const data = await getMyNotificationsAction();
      setItems(data.items);
      setUnread(data.unread);
    } catch {
      // silencioso — falha de fetch não deve quebrar UI
    }
  }, []);

  // Fetch inicial + fallback de poll a cada 5min (caso o websocket caia
  // por algum motivo) + refetch on focus pra não confiar 100% no realtime.
  // O setTimeout(0) tira a primeira chamada de dentro do body do effect
  // (sai do warning react-hooks/set-state-in-effect) sem mudar a UX —
  // ainda dispara antes do primeiro paint.
  useEffect(() => {
    const initialKick = setTimeout(() => void fetchData(), 0);
    const interval = setInterval(fetchData, 5 * 60_000);
    const onFocus = () => void fetchData();
    window.addEventListener("focus", onFocus);
    return () => {
      clearTimeout(initialKick);
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchData]);

  // Realtime: nova notificação ou mudança em uma existente (lida/etc)
  // pro user atual → re-fetcha a lista + contador.
  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let channelRef: any = null;
    let unsubAuth: (() => void) | null = null;

    async function start() {
      unsubAuth = await authenticateRealtime(supabase);
      if (cancelled) return;
      const ch = supabase
        .channel(`notifications:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          () => {
            void fetchData();
          },
        )
        .subscribe();
      channelRef = ch;
    }

    void start();

    return () => {
      cancelled = true;
      unsubAuth?.();
      if (channelRef) supabase.removeChannel(channelRef);
    };
  }, [userId, fetchData]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function handleMarkAll() {
    if (markingAll) return;
    setMarkingAll(true);
    try {
      await markAllNotificationsReadAction();
      const data = await getMyNotificationsAction();
      setItems(data.items);
      setUnread(data.unread);
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Notificações"
        aria-expanded={open}
        aria-haspopup="true"
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
                disabled={markingAll}
                className="text-[11px] text-primary hover:underline disabled:opacity-50"
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
