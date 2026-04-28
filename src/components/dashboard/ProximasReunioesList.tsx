import Link from "next/link";
import { Briefcase, Handshake } from "lucide-react";
import type { ProximaReuniao } from "@/lib/dashboard/comercial-queries";

interface Props {
  reunioes: ProximaReuniao[];
}

const TIPO_LABEL = {
  prospeccao_agendada: "Prospecção",
  marco_zero: "Marco zero",
};

const TIPO_ICON = {
  prospeccao_agendada: Briefcase,
  marco_zero: Handshake,
};

const TIPO_COLOR = {
  prospeccao_agendada: "text-blue-600 dark:text-blue-400",
  marco_zero: "text-purple-600 dark:text-purple-400",
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

export function ProximasReunioesList({ reunioes }: Props) {
  if (reunioes.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">Sem reuniões nos próximos 14 dias.</p>;
  }

  return (
    <ul className="space-y-2">
      {reunioes.map((r) => {
        const Icon = TIPO_ICON[r.tipo];
        return (
          <li key={`${r.leadId}-${r.tipo}`} className="flex items-center gap-3 text-sm">
            <Icon className={`h-4 w-4 shrink-0 ${TIPO_COLOR[r.tipo]}`} />
            <div className="min-w-0 flex-1">
              <Link href={`/onboarding/${r.leadId}`} className="font-medium hover:underline truncate block">
                {r.nomeProspect}
              </Link>
              <div className="text-xs text-muted-foreground">
                {TIPO_LABEL[r.tipo]} · {formatRelative(r.data)}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
