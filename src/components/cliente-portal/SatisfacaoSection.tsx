import { Heart, Star, Clock } from "lucide-react";
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
    <section className="overflow-hidden rounded-2xl border bg-card">
      <div className="bg-gradient-to-br from-primary/10 via-card to-card p-6 sm:p-8">
        <header className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Heart className="h-4 w-4 fill-current" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider">Satisfação</h2>
            <p className="text-xs text-muted-foreground">
              Como vocês veem a Yide × como a Yide vê vocês
            </p>
          </div>
        </header>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Coluna 1: cliente avalia a agência */}
          <div className="rounded-xl border bg-background/40 p-5">
            <h3 className="text-sm font-bold">Sua nota pra Yide</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Como você avalia a parceria conosco?
            </p>

            {selfLast && <SelfLastDisplay data={selfLast} />}

            <div className="mt-4">
              <SelfSatisfactionForm hasPrevious={selfLast !== null} />
            </div>
          </div>

          {/* Coluna 2: percepção da equipe */}
          <div className="rounded-xl border bg-background/40 p-5">
            <h3 className="text-sm font-bold">Como a Yide te percebe</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Visão da equipe sobre a parceria.
            </p>

            <div className="mt-5">
              {agencyLast ? (
                <AgencyScoreDisplay data={agencyLast} />
              ) : (
                <EmptyAgencyPerception />
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SelfLastDisplay({ data }: { data: SelfSatisfactionRow }) {
  const isPositive = data.score >= 8;
  const isNeutral = data.score >= 5 && data.score < 8;
  const ringColor = isPositive
    ? "ring-emerald-500/40 bg-emerald-500/10"
    : isNeutral
    ? "ring-amber-500/40 bg-amber-500/10"
    : "ring-red-500/40 bg-red-500/10";

  return (
    <div className={`mt-4 flex items-center gap-3 rounded-lg ring-1 p-3 ${ringColor}`}>
      <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-background ring-2 ring-current">
        <span className="text-xl font-bold tabular-nums">{data.score}</span>
      </div>
      <div className="min-w-0 flex-1 text-xs">
        <div className="flex items-center gap-1 text-muted-foreground">
          <Clock className="h-3 w-3" />
          Última avaliação · {formatDate(data.submitted_at)}
        </div>
        {data.comentario && (
          <p className="mt-1 italic text-foreground/80 line-clamp-2">
            &ldquo;{data.comentario}&rdquo;
          </p>
        )}
      </div>
    </div>
  );
}

function AgencyScoreDisplay({ data }: { data: AgencyPerceptionRow }) {
  const corStyles = {
    verde: {
      ring: "stroke-emerald-500",
      text: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10",
      label: "Tudo bem",
      emoji: "🟢",
    },
    amarelo: {
      ring: "stroke-amber-500",
      text: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10",
      label: "Atenção",
      emoji: "🟡",
    },
    vermelho: {
      ring: "stroke-red-500",
      text: "text-red-600 dark:text-red-400",
      bg: "bg-red-500/10",
      label: "Alerta",
      emoji: "🔴",
    },
  } as const;
  const style = corStyles[data.cor_final];
  const score = Math.round(data.score_final);

  // SVG ring — circunferência 2πr com r=42, perímetro ≈ 263.89
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <svg width="120" height="120" viewBox="0 0 100 100" className="-rotate-90">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-muted/40"
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={`${style.ring} transition-all`}
            style={{ strokeDashoffset: offset }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className={`text-3xl font-bold tabular-nums ${style.text}`}>{score}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            de 100
          </div>
        </div>
      </div>

      <div className={`rounded-full px-3 py-1 text-sm font-medium ${style.bg} ${style.text}`}>
        {style.emoji} {style.label}
      </div>
      <div className="text-[11px] text-muted-foreground">
        Semana {formatSemanaIso(data.semana_iso)}
      </div>
    </div>
  );
}

function EmptyAgencyPerception() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/40 text-muted-foreground">
        <Star className="h-5 w-5" />
      </div>
      <p className="text-xs text-muted-foreground">
        A equipe ainda não registrou uma avaliação desta semana.
        <br />
        Atualizamos toda semana.
      </p>
    </div>
  );
}

function formatSemanaIso(iso: string): string {
  const match = iso.match(/^(\d{4})-W(\d{1,2})$/);
  if (!match) return iso;
  return `${match[2]}/${match[1]}`;
}
