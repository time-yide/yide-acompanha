import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { computeWeeklyRanking, sliceTopBottom } from "@/lib/satisfacao/ranking";
import { currentIsoWeek, previousIsoWeek } from "@/lib/satisfacao/iso-week";
import { RankingResumo } from "@/components/dashboard/RankingResumo";
import { OthersTable } from "@/components/satisfacao/OthersTable";
import { WeekSelector } from "@/components/satisfacao/WeekSelector";

export default async function SatisfacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string }>;
}) {
  const params = await searchParams;
  const user = await requireAuth();

  // Default: semana com avaliações; se atual ainda vazia, usa anterior
  let weekIso = params.semana && /^\d{4}-W\d{2}$/.test(params.semana) ? params.semana : currentIsoWeek();
  let all = await computeWeeklyRanking(weekIso);
  if (all.length === 0 && !params.semana) {
    weekIso = previousIsoWeek(weekIso);
    all = await computeWeeklyRanking(weekIso);
  }

  const { top, bottom } = sliceTopBottom(all);

  // Demais: clientes ranqueados que não estão em top nem bottom
  const topIds = new Set(top.map((s) => s.id));
  const bottomIds = new Set(bottom.map((s) => s.id));
  const others = all
    .filter((s) => !topIds.has(s.id) && !bottomIds.has(s.id))
    .map((s) => ({
      id: s.id,
      client_id: s.client_id,
      cliente_nome: s.cliente?.nome ?? "",
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
    <div className="mx-auto max-w-6xl space-y-6">
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

      {all.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
          Nenhuma avaliação nesta semana ainda.
        </p>
      ) : (
        <>
          <RankingResumo top={top} bottom={bottom} />

          {others.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground/80">
                Demais clientes
              </h2>
              <OthersTable rows={others} />
            </section>
          )}
        </>
      )}
    </div>
  );
}
