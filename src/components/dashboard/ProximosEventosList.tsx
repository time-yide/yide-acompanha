import { CalendarClock, Cake, Briefcase, Video, Users, type LucideIcon } from "lucide-react";
import type { EventoRow } from "@/lib/dashboard/queries";
import { APP_TIMEZONE, formatTimeBR, getDatePartsInAppTz } from "@/lib/datetime/timezone";

interface Props {
  eventos: EventoRow[];
}

// Mapeia cada sub_calendar pro seu ícone. IMPORTANTE: precisa cobrir TODOS
// os valores possíveis de sub_calendar - caso contrário, lookup retorna
// undefined e o React quebra com error #130 ("Element type is invalid").
// Fallback CalendarClock + cor muted garantem segurança caso surjam novos
// sub_calendars no futuro sem que esse mapa seja atualizado.
const subCalendarIcon: Record<string, LucideIcon> = {
  agencia: CalendarClock,
  onboarding: Briefcase,
  aniversarios: Cake,
  videomakers: Video,
  assessores: Users,
  coordenadores: Briefcase,
};

const subCalendarColor: Record<string, string> = {
  agencia: "text-blue-600 dark:text-blue-400",
  onboarding: "text-purple-600 dark:text-purple-400",
  aniversarios: "text-pink-600 dark:text-pink-400",
  videomakers: "text-fuchsia-600 dark:text-fuchsia-400",
  assessores: "text-amber-600 dark:text-amber-400",
  coordenadores: "text-orange-600 dark:text-orange-400",
};

function formatRelative(iso: string): string {
  const eventDate = new Date(iso);
  const now = new Date();
  const todayParts = getDatePartsInAppTz(now);
  const eventParts = getDatePartsInAppTz(eventDate);

  // Calcula "amanhã" no fuso da app via Date.UTC + offset.
  const tomorrowUtcMs = Date.UTC(
    parseInt(todayParts.year, 10),
    parseInt(todayParts.month, 10) - 1,
    parseInt(todayParts.day, 10) + 1,
    12,
    0,
    0,
  );
  const tomorrowParts = getDatePartsInAppTz(new Date(tomorrowUtcMs));

  const isToday =
    eventParts.year === todayParts.year &&
    eventParts.month === todayParts.month &&
    eventParts.day === todayParts.day;
  const isTomorrow =
    eventParts.year === tomorrowParts.year &&
    eventParts.month === tomorrowParts.month &&
    eventParts.day === tomorrowParts.day;

  if (isToday) {
    return `Hoje, ${formatTimeBR(eventDate)}`;
  }
  if (isTomorrow) {
    return `Amanhã, ${formatTimeBR(eventDate)}`;
  }
  return eventDate.toLocaleDateString("pt-BR", {
    timeZone: APP_TIMEZONE,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ProximosEventosList({ eventos }: Props) {
  if (eventos.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">Sem eventos nos próximos 30 dias.</p>;
  }

  return (
    <ul className="space-y-2">
      {eventos.map((e) => {
        const Icon = subCalendarIcon[e.sub_calendar] ?? CalendarClock;
        const color = subCalendarColor[e.sub_calendar] ?? "text-muted-foreground";
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
