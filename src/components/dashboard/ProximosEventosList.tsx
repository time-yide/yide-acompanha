import { CalendarClock, Cake, Briefcase } from "lucide-react";
import type { EventoRow } from "@/lib/dashboard/queries";

interface Props {
  eventos: EventoRow[];
}

const subCalendarIcon = {
  agencia: CalendarClock,
  onboarding: Briefcase,
  aniversarios: Cake,
};

const subCalendarColor = {
  agencia: "text-blue-600 dark:text-blue-400",
  onboarding: "text-purple-600 dark:text-purple-400",
  aniversarios: "text-pink-600 dark:text-pink-400",
};

function formatRelative(iso: string): string {
  const eventDate = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const eventDay = new Date(eventDate);
  eventDay.setHours(0, 0, 0, 0);

  if (eventDay.getTime() === today.getTime()) {
    return `Hoje, ${eventDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  }
  if (eventDay.getTime() === tomorrow.getTime()) {
    return `Amanhã, ${eventDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return eventDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function ProximosEventosList({ eventos }: Props) {
  if (eventos.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">Sem eventos nos próximos 30 dias.</p>;
  }

  return (
    <ul className="space-y-2">
      {eventos.map((e) => {
        const Icon = subCalendarIcon[e.sub_calendar];
        const color = subCalendarColor[e.sub_calendar];
        return (
          <li key={e.id} className="flex items-center gap-3 text-sm">
            <Icon className={`h-4 w-4 shrink-0 ${color}`} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{e.titulo}</div>
              <div className="text-xs text-muted-foreground">{formatRelative(e.inicio)}</div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
