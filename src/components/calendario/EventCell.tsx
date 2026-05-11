import Link from "next/link";
import { Video } from "lucide-react";
import type { CalendarEvent } from "@/lib/calendario/schema";
import { formatBrtTime } from "@/lib/calendario/timezone";

const subClass: Record<string, string> = {
  agencia: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-l-2 border-violet-500",
  onboarding: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-l-2 border-blue-500",
  aniversarios: "bg-pink-500/15 text-pink-700 dark:text-pink-300 border-l-2 border-pink-500",
  // Videomakers: cor mais forte + borda mais grossa pra destacar.
  videomakers:
    "bg-fuchsia-500/25 text-fuchsia-900 dark:text-fuchsia-100 border-l-4 border-fuchsia-500 ring-1 ring-fuchsia-500/40 shadow-sm",
  assessores: "bg-amber-500/15 text-amber-800 dark:text-amber-200 border-l-2 border-amber-500",
  coordenadores: "bg-orange-500/15 text-orange-800 dark:text-orange-200 border-l-2 border-orange-500",
};

export function EventCell({ event }: { event: CalendarEvent }) {
  const isVm = event.sub_calendar === "videomakers";
  const content = (
    // Mobile: padding e fonte maiores (full-width comporta). Desktop: compacto como antes.
    <div className={`rounded-md p-2 ${subClass[event.sub_calendar] ?? subClass.agencia} text-xs leading-tight sm:p-1.5 sm:text-[11px]`}>
      <div className="flex items-center gap-1 font-semibold truncate">
        {isVm && <Video className="h-3.5 w-3.5 flex-shrink-0 sm:h-3 sm:w-3" />}
        <span className="truncate">{event.titulo}</span>
      </div>
      <div className="opacity-70">{formatBrtTime(event.inicio)}</div>
    </div>
  );
  return event.link ? <Link href={event.link}>{content}</Link> : content;
}
