import { Heart } from "lucide-react";
import { SelfSatisfactionForm } from "./SelfSatisfactionForm";
import type {
  SelfSatisfactionRow,
  AgencyPerceptionRow,
} from "@/lib/cliente-portal/queries";

interface Props {
  selfLast: SelfSatisfactionRow | null;
  agencyLast: AgencyPerceptionRow | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: "America/Cuiaba",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function SatisfacaoSection({ selfLast, agencyLast }: Props) {
  return (
    <section className="rounded-xl border bg-card p-5 space-y-4">
      <header className="flex items-center gap-2">
        <Heart className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Satisfação
        </h2>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Coluna 1: cliente avalia a agência */}
        <div className="space-y-3 rounded-lg bg-muted/30 p-4">
          <div>
            <h3 className="text-sm font-semibold">Sua nota pra Yide</h3>
            <p className="text-xs text-muted-foreground">
              Como você avalia a parceria conosco hoje?
            </p>
          </div>

          {selfLast && (
            <div className="rounded-md border bg-background/50 p-2.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tabular-nums">{selfLast.score}/10</span>
                <span className="text-muted-foreground">
                  · enviada em {formatDate(selfLast.submitted_at)}
                </span>
              </div>
              {selfLast.comentario && (
                <p className="mt-1.5 text-muted-foreground italic">
                  &ldquo;{selfLast.comentario}&rdquo;
                </p>
              )}
            </div>
          )}

          <SelfSatisfactionForm hasPrevious={selfLast !== null} />
        </div>

        {/* Coluna 2: percepção da equipe */}
        <div className="space-y-3 rounded-lg bg-muted/30 p-4">
          <div>
            <h3 className="text-sm font-semibold">Como a Yide te percebe</h3>
            <p className="text-xs text-muted-foreground">
              Visão da equipe sobre a parceria.
            </p>
          </div>

          {agencyLast ? (
            <AgencyPerceptionCard data={agencyLast} />
          ) : (
            <div className="rounded-md border bg-background/50 p-3 text-xs text-muted-foreground">
              A equipe ainda não registrou uma avaliação desta semana.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function AgencyPerceptionCard({ data }: { data: AgencyPerceptionRow }) {
  const corColors = {
    verde: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-500/30",
    amarelo: "bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-500/30",
    vermelho: "bg-red-500/15 text-red-700 dark:text-red-300 ring-red-500/30",
  } as const;
  const corLabel = {
    verde: "Tudo bem 🟢",
    amarelo: "Atenção 🟡",
    vermelho: "Alerta 🔴",
  } as const;

  // semana_iso vem como "2026-W19" — convertemos pra range visual.
  const semanaLabel = formatSemanaIso(data.semana_iso);

  return (
    <div className={`rounded-md ring-1 p-3 ${corColors[data.cor_final]}`}>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold tabular-nums">
          {Math.round(data.score_final)}
        </span>
        <span className="text-xs opacity-80">/ 100</span>
      </div>
      <div className="mt-0.5 text-sm font-medium">{corLabel[data.cor_final]}</div>
      <div className="mt-1 text-[11px] opacity-70">Semana {semanaLabel}</div>
    </div>
  );
}

function formatSemanaIso(iso: string): string {
  // "2026-W19" → "19 (2026)"
  const match = iso.match(/^(\d{4})-W(\d{1,2})$/);
  if (!match) return iso;
  return `${match[2]} (${match[1]})`;
}
