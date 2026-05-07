"use client";

import Link from "next/link";
import { Hash } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChannelWithUnread } from "@/lib/escritorio/types";

interface Props {
  channels: ChannelWithUnread[];
  currentKind: string;
}

export function ChannelSidebar({ channels, currentKind }: Props) {
  return (
    <aside className="flex w-full flex-col gap-1 rounded-xl border bg-card p-3 md:w-64">
      <h2 className="px-2 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Canais
      </h2>
      {channels.map((c) => {
        const active = c.kind === currentKind;
        return (
          <Link
            key={c.id}
            href={`/escritorio/${c.kind}`}
            className={cn(
              "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
              active ? "bg-primary/15 text-primary font-medium" : "text-foreground/80 hover:bg-muted",
            )}
          >
            <span className="flex items-center gap-1.5 min-w-0">
              <Hash className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{c.nome}</span>
            </span>
            {c.unread_count > 0 && (
              <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                {c.unread_count > 99 ? "99+" : c.unread_count}
              </span>
            )}
          </Link>
        );
      })}
    </aside>
  );
}
