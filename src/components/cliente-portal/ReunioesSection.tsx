import { Mic } from "lucide-react";
import type { ReuniaoListItem } from "@/lib/cliente-portal/queries";

interface Props {
  reunioes: ReuniaoListItem[];
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Cuiaba",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuracao(segundos: number | null): string {
  if (!segundos) return "—";
  const min = Math.round(segundos / 60);
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

export function ReunioesSection({ reunioes }: Props) {
  if (reunioes.length === 0) {
    return (
      <section className="rounded-xl border bg-card p-5 space-y-3">
        <header className="flex items-center gap-2">
          <Mic className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Últimas reuniões
          </h2>
        </header>
        <p className="text-sm text-muted-foreground">
          Nenhuma reunião registrada ainda. Quando vocês tiverem encontros gravados
          com a equipe, os resumos vão aparecer aqui.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border bg-card p-5 space-y-4">
      <header className="flex items-center gap-2">
        <Mic className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Últimas reuniões
        </h2>
      </header>

      <ul className="space-y-3">
        {reunioes.map((r) => (
          <li key={r.id} className="rounded-lg border bg-background/50 p-3">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-medium">{r.titulo}</h3>
              <span className="flex-shrink-0 text-[11px] text-muted-foreground">
                {formatDateTime(r.starts_at)} · {formatDuracao(r.duracao_segundos)}
              </span>
            </div>
            {r.summary_ready && r.resumo_preview ? (
              <p className="mt-1.5 text-sm text-muted-foreground">
                {r.resumo_preview}
              </p>
            ) : (
              <p className="mt-1.5 text-xs italic text-muted-foreground/70">
                Resumo em processamento…
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
