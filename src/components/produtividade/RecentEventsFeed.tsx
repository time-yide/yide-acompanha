import { Activity } from "lucide-react";
import { EVENT_LABEL } from "@/lib/produtividade/schema";
import type { RecentEventRow } from "@/lib/produtividade/queries";

interface Props {
  events: RecentEventRow[];
}

function relativeTime(iso: string): string {
  const now = Date.now();
  const t = new Date(iso).getTime();
  const diffSec = Math.floor((now - t) / 1000);
  if (diffSec < 60) return "agora";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: "America/Cuiaba",
    day: "2-digit",
    month: "2-digit",
  });
}

export function RecentEventsFeed({ events }: Props) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        <Activity className="h-8 w-8 text-muted-foreground/40" />
        <p>Nenhuma atividade registrada ainda.</p>
        <p className="text-xs">
          Eventos vão aparecer conforme o time interagir com o sistema.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="border-b bg-muted/30 px-4 py-2.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Últimas atividades
        </h3>
      </div>
      <ul className="divide-y">
        {events.map((e) => (
          <li key={e.id} className="flex items-start gap-3 px-4 py-2.5 text-sm">
            <div className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary/60" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate">
                  <span className="font-medium">{e.user_nome}</span>
                  <span className="text-muted-foreground"> · {EVENT_LABEL[e.event_type]}</span>
                </p>
                <span className="flex-shrink-0 text-[10px] tabular-nums text-muted-foreground">
                  {relativeTime(e.created_at)}
                </span>
              </div>
              {e.client_nome && (
                <p className="text-[11px] text-muted-foreground">
                  cliente: {e.client_nome}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
