import Link from "next/link";
import type { CalendarEvent } from "@/lib/calendario/schema";

const subClass: Record<string, string> = {
  agencia: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-l-2 border-violet-500",
  onboarding: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-l-2 border-blue-500",
  aniversarios: "bg-pink-500/15 text-pink-700 dark:text-pink-300 border-l-2 border-pink-500",
};

function formatHour(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function EventCell({ event }: { event: CalendarEvent }) {
  const content = (
    <div className={`rounded-md p-1.5 ${subClass[event.sub_calendar]} text-[11px] leading-tight`}>
      <div className="font-semibold truncate">{event.titulo}</div>
      <div className="opacity-70">{formatHour(event.inicio)}</div>
    </div>
  );
  return event.link ? <Link href={event.link}>{content}</Link> : content;
}
