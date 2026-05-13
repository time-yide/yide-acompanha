import { Mic, MessageSquareText, Video } from "lucide-react";
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
      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="bg-gradient-to-br from-primary/10 via-card to-card p-6 sm:p-8">
          <header className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Mic className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider">Últimas reuniões</h2>
              <p className="text-xs text-muted-foreground">Resumos automáticos das conversas</p>
            </div>
          </header>

          <div className="mt-6 flex flex-col items-center gap-3 rounded-xl border border-dashed bg-muted/20 px-6 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Video className="h-5 w-5" />
            </div>
            <p className="max-w-sm text-sm text-muted-foreground">
              Quando vocês tiverem encontros gravados com a equipe,
              os resumos vão aparecer aqui automaticamente.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border bg-card">
      <div className="bg-gradient-to-br from-primary/10 via-card to-card p-6 sm:p-8">
        <header className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Mic className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider">Últimas reuniões</h2>
            <p className="text-xs text-muted-foreground">
              {reunioes.length} {reunioes.length === 1 ? "reunião" : "reuniões"} recente{reunioes.length === 1 ? "" : "s"}
            </p>
          </div>
        </header>

        <ol className="mt-5 space-y-3">
          {reunioes.map((r) => (
            <li
              key={r.id}
              className="group rounded-xl border bg-background/40 p-4 transition-all hover:border-primary/40 hover:bg-background/70"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <MessageSquareText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-sm font-semibold">{r.titulo}</h3>
                    <span className="flex-shrink-0 text-[11px] text-muted-foreground">
                      {formatDateTime(r.starts_at)} · {formatDuracao(r.duracao_segundos)}
                    </span>
                  </div>
                  {r.summary_ready && r.resumo_preview ? (
                    <p className="mt-1.5 text-sm text-muted-foreground">{r.resumo_preview}</p>
                  ) : (
                    <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs italic text-primary/70">
                      <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                      Resumo em processamento…
                    </p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
