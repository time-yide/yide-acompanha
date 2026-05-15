import { Star, ExternalLink, MessageCircle, TrendingUp } from "lucide-react";
import type { GmbTimeSeriesPoint } from "@/lib/clientes/gmb-snapshots";
import { GmbEvolutionChart } from "@/components/painel-gmb/GmbEvolutionChart";

interface Props {
  gmb_link: string | null;
  gmb_rating: number | null;
  gmb_review_count: number | null;
  gmb_last_update_at: string | null;
  /** Histórico dos últimos 90 dias pra plotar evolução. Vazio = sem dados ainda. */
  timeSeries?: GmbTimeSeriesPoint[];
}

const BR_DATE = (iso: string): string =>
  new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: "America/Cuiaba",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

/**
 * Seção de Google Meu Negócio no portal do cliente. Mostra nota, número de
 * reviews e link pro perfil. Quando não tem dado cadastrado, seção não renderiza
 * (não polui pra cliente sem GMB cadastrado pela Yide).
 */
export function GmbSection({
  gmb_link,
  gmb_rating,
  gmb_review_count,
  gmb_last_update_at,
  timeSeries = [],
}: Props) {
  // Se NENHUM dado tá cadastrado, esconde a seção
  const hasAnyData = gmb_link || gmb_rating !== null || gmb_review_count !== null;
  if (!hasAnyData) return null;

  const rating = gmb_rating !== null ? Number(gmb_rating) : null;
  const reviews = gmb_review_count ?? 0;

  // Estrelas — full / half / empty
  const renderStars = () => {
    if (rating === null) return null;
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      const filled = rating >= i - 0.25;
      const half = !filled && rating >= i - 0.75;
      stars.push(
        <Star
          key={i}
          className={`h-4 w-4 ${
            filled || half ? "fill-amber-500 text-amber-500" : "text-muted-foreground/30"
          }`}
          // Half-star ficaria mais polido com SVG mask; aceitamos aproximação visual
        />,
      );
    }
    return stars;
  };

  return (
    <section className="overflow-hidden rounded-2xl border bg-card">
      <div className="bg-gradient-to-br from-amber-500/10 via-card to-card p-6 sm:p-8">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Star className="h-4 w-4 fill-current" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider">Google Meu Negócio</h2>
              <p className="text-xs text-muted-foreground">Reputação do seu perfil</p>
            </div>
          </div>
        </header>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {rating !== null && (
            <div className="rounded-xl border bg-background/40 p-3">
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                <Star className="h-3 w-3" />
                Nota média
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-3xl font-bold tabular-nums">
                  {rating.toFixed(1)}
                </span>
                <span className="text-sm text-muted-foreground">/ 5</span>
              </div>
              <div className="mt-2 flex items-center gap-0.5">{renderStars()}</div>
            </div>
          )}

          {gmb_review_count !== null && (
            <div className="rounded-xl border bg-background/40 p-3">
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                <MessageCircle className="h-3 w-3" />
                Avaliações
              </div>
              <div className="mt-1.5 text-3xl font-bold tabular-nums">
                {reviews.toLocaleString("pt-BR")}
              </div>
              <div className="mt-2 text-[11px] text-muted-foreground">
                {reviews === 1 ? "review no GMB" : "reviews no GMB"}
              </div>
            </div>
          )}
        </div>

        {gmb_link && (
          <a
            href={gmb_link}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-500/20 dark:text-amber-300"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Ver perfil no Google Maps
          </a>
        )}

        {gmb_last_update_at && (
          <p className="mt-3 text-[11px] text-muted-foreground">
            Dados atualizados em {BR_DATE(gmb_last_update_at)}.
          </p>
        )}

        {/* Gráfico de evolução — só renderiza se tem snapshots histórico */}
        {timeSeries.length >= 2 && (
          <div className="mt-6 rounded-xl border bg-background/40 p-4">
            <div className="mb-3 flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Evolução nos últimos 90 dias
              </h3>
            </div>
            <GmbEvolutionChart data={timeSeries} />
          </div>
        )}
      </div>
    </section>
  );
}
