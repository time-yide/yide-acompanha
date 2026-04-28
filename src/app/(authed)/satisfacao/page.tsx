import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { getSynthesisForWeek } from "@/lib/satisfacao/queries";
import { currentIsoWeek, previousIsoWeek } from "@/lib/satisfacao/iso-week";
import { RankingCard } from "@/components/satisfacao/RankingCard";
import { OthersTable } from "@/components/satisfacao/OthersTable";
import { WeekSelector } from "@/components/satisfacao/WeekSelector";

export default async function SatisfacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string }>;
}) {
  const params = await searchParams;
  const user = await requireAuth();

  // Default: semana com sínteses; se atual ainda vazia, usa anterior
  let weekIso = params.semana && /^\d{4}-W\d{2}$/.test(params.semana) ? params.semana : currentIsoWeek();
  let allSyntheses = await getSynthesisForWeek(weekIso);
  if (allSyntheses.length === 0 && !params.semana) {
    weekIso = previousIsoWeek(weekIso);
    allSyntheses = await getSynthesisForWeek(weekIso);
  }

  // Top 10 verde (score desc)
  const top10 = allSyntheses
    .filter((s) => s.cor_final === "verde")
    .sort((a, b) => Number(b.score_final) - Number(a.score_final))
    .slice(0, 10);

  // Bottom 10 (vermelho/amarelo, prioridade vermelho — score asc)
  const bottomCandidates = allSyntheses.filter((s) => s.cor_final === "vermelho" || s.cor_final === "amarelo");
  const bottom10 = bottomCandidates
    .sort((a, b) => {
      // Vermelhos primeiro, depois amarelos
      if (a.cor_final === "vermelho" && b.cor_final !== "vermelho") return -1;
      if (a.cor_final !== "vermelho" && b.cor_final === "vermelho") return 1;
      return Number(a.score_final) - Number(b.score_final);
    })
    .slice(0, 10);

  // Demais
  const topIds = new Set(top10.map((s) => s.id));
  const bottomIds = new Set(bottom10.map((s) => s.id));
  const others = allSyntheses
    .filter((s) => !topIds.has(s.id) && !bottomIds.has(s.id))
    .map((s) => ({
      id: s.id,
      client_id: s.client_id,
      cliente_nome: s.cliente?.nome ?? "—",
      score_final: Number(s.score_final),
      cor_final: s.cor_final,
    }));

  // Opções de seleção: últimas 12 semanas
  const weekOptions: string[] = [];
  let cursor = currentIsoWeek();
  for (let i = 0; i < 12; i++) {
    weekOptions.push(cursor);
    cursor = previousIsoWeek(cursor);
  }

  const canFeed = canAccess(user.role, "feed:satisfaction");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Satisfação</h1>
          <p className="text-sm text-muted-foreground">
            Ranking dos clientes mais e menos satisfeitos · Semana {weekIso}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <WeekSelector current={weekIso} options={weekOptions} />
          {canFeed && (
            <Link
              href="/satisfacao/avaliar"
              className="text-sm text-primary hover:underline"
            >
              Avaliar esta semana →
            </Link>
          )}
        </div>
      </header>

      {allSyntheses.length === 0 ? (
        <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          Sem sínteses para esta semana ainda.
        </p>
      ) : (
        <>
          {top10.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-green-600 dark:text-green-400">
                Top {top10.length} mais satisfeitos
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {top10.map((s, i) => (
                  <RankingCard
                    key={s.id}
                    rank={i + 1}
                    clientId={s.client_id}
                    clientNome={s.cliente?.nome ?? "—"}
                    scoreFinal={Number(s.score_final)}
                    corFinal={s.cor_final}
                    acaoSugerida={s.acao_sugerida}
                    variant="top"
                  />
                ))}
              </div>
            </section>
          )}

          {bottom10.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-red-600 dark:text-red-400">
                Top {bottom10.length} menos satisfeitos
              </h2>
              <p className="text-xs text-muted-foreground">Atenção urgente — risco de churn</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {bottom10.map((s, i) => (
                  <RankingCard
                    key={s.id}
                    rank={i + 1}
                    clientId={s.client_id}
                    clientNome={s.cliente?.nome ?? "—"}
                    scoreFinal={Number(s.score_final)}
                    corFinal={s.cor_final}
                    acaoSugerida={s.acao_sugerida}
                    variant="bottom"
                  />
                ))}
              </div>
            </section>
          )}

          {others.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Demais clientes</h2>
              <OthersTable rows={others} />
            </section>
          )}
        </>
      )}
    </div>
  );
}
