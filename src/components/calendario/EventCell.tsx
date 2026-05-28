import Link from "next/link";
import { Video, User, UserPlus } from "lucide-react";
import type { CalendarEvent } from "@/lib/calendario/schema";
import { formatBrtTime } from "@/lib/calendario/timezone";
import { computaStatus } from "@/lib/briefing-gravacao/status";

// Light mode usa cor sólida 100/200 + texto 900/950 pra contraste forte.
// Dark mode mantém overlay /15-/25 que já funciona bem no fundo escuro.
const subClass: Record<string, string> = {
  agencia: "bg-violet-100 text-violet-950 dark:bg-violet-500/15 dark:text-violet-300 border-l-2 border-violet-500",
  onboarding: "bg-blue-100 text-blue-950 dark:bg-blue-500/15 dark:text-blue-300 border-l-2 border-blue-500",
  aniversarios: "bg-pink-100 text-pink-950 dark:bg-pink-500/15 dark:text-pink-300 border-l-2 border-pink-500",
  // Videomakers: cor mais forte + borda mais grossa pra destacar.
  videomakers:
    "bg-fuchsia-200 text-fuchsia-950 dark:bg-fuchsia-500/25 dark:text-fuchsia-100 border-l-4 border-fuchsia-500 ring-1 ring-fuchsia-500/40 shadow-sm",
  assessores: "bg-amber-100 text-amber-950 dark:bg-amber-500/15 dark:text-amber-200 border-l-2 border-amber-500",
  coordenadores: "bg-orange-100 text-orange-950 dark:bg-orange-500/15 dark:text-orange-200 border-l-2 border-orange-500",
};

export function EventCell({ event }: { event: CalendarEvent }) {
  const isVm = event.sub_calendar === "videomakers";
  const assignedNome = event.videomaker_assigned_nome;
  const isPending =
    isVm && (event.videomaker_status === "pending_delegation" || !event.videomaker_assigned_id);
  const content = (
    // Mobile: padding e fonte maiores (full-width comporta). Desktop: compacto como antes.
    <div className={`rounded-md p-2 ${subClass[event.sub_calendar] ?? subClass.agencia} text-xs leading-tight sm:p-1.5 sm:text-[11px]`}>
      <div className="flex items-center gap-1 font-semibold truncate">
        {isVm && <Video className="h-3.5 w-3.5 flex-shrink-0 sm:h-3 sm:w-3" />}
        {isVm && (() => {
          const status = computaStatus({
            roteiro_tipo: event.roteiro_tipo ?? null,
            videomaker_leu_em: event.videomaker_leu_em ?? null,
            videomaker_imprimiu_em: event.videomaker_imprimiu_em ?? null,
          });
          const meta = {
            sem_roteiro: { bg: "bg-red-500", title: "Sem roteiro" },
            pendente: { bg: "bg-amber-500", title: "Briefing pendente" },
            pronto: { bg: "bg-emerald-500", title: "Pronto pra gravar" },
          }[status];
          return (
            <span
              className={`mr-1 inline-block h-2 w-2 rounded-full flex-shrink-0 ${meta.bg}`}
              title={meta.title}
            />
          );
        })()}
        <span className="truncate">{event.titulo}</span>
      </div>
      <div className="opacity-70">{formatBrtTime(event.inicio)}</div>
      {isVm && (
        <div className="mt-0.5 flex items-center gap-1 truncate font-medium opacity-90">
          {isPending ? (
            <>
              <UserPlus className="h-3 w-3 flex-shrink-0" />
              <span className="truncate italic">Aguardando designação</span>
            </>
          ) : (
            <>
              <User className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{assignedNome ?? "Videomaker"}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
  return event.link ? <Link href={event.link}>{content}</Link> : content;
}
