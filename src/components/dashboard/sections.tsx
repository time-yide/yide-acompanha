// Cada seção async puxa só sua própria query. Combinadas com <Suspense>
// no DashboardSocioAdm, o shell renderiza imediatamente (saudação + grid)
// e cada parte pesada streama quando fica pronta. Mobile sente a
// diferença: visível em ~300ms vs 2s+ da versão antiga com Promise.all
// bloqueando tudo.

import {
  getKpis,
  getCarteiraTimeline,
  getEntradaChurn,
  getCarteiraPorAssessor,
  getRankingSatisfacao,
  getProximosEventos,
  getMesAguardandoAprovacao,
} from "@/lib/dashboard/queries";
import { getEffectiveUnitId } from "@/lib/units/session";
import { getClientIdsForActiveUnit } from "@/lib/units/filter-helpers";
import { getComissaoPrevista } from "@/lib/dashboard/comissao-prevista";
import { KpiRow } from "./KpiRow";
import { ChartCarteiraTimelineLazy } from "./ChartCarteiraTimelineLazy";
import { ChartEntradaChurnLazy } from "./ChartEntradaChurnLazy";
import { CarteiraPorAssessorList } from "./CarteiraPorAssessorList";
import { RankingResumo } from "./RankingResumo";
import { ProximosEventosList } from "./ProximosEventosList";
import { AlertaAprovacao } from "./AlertaAprovacao";
import { RemuneracaoCard } from "./RemuneracaoCard";
import { Section } from "./Section";
import { InstagramPostsCard } from "./InstagramPostsCard";
import { listClientesComUltimoSnapshot } from "@/lib/instagram-snapshots/queries";

// Charts via wrappers *Lazy (ChartCarteiraTimelineLazy / ChartEntradaChurnLazy).
// Cada wrapper é "use client" e usa next/dynamic({ ssr: false }), tirando o
// recharts (~110KB gzipped) do bundle inicial. O fallback do dynamic mostra
// um skeleton enquanto o chunk baixa — em mobile 4G a diferença no first
// paint é bem perceptível.

// ----- Skeletons (base genérica, baixo custo de DOM) -----

function Skel({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />;
}

export function KpiRowSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skel key={i} className="h-20 sm:h-24" />
      ))}
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <Section title="Carregando…">
      <Skel className="h-48 sm:h-64" />
    </Section>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Section title="Carregando…">
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skel key={i} className="h-9" />
        ))}
      </div>
    </Section>
  );
}

// ----- Async sections (cada uma faz sua query) -----

export async function AlertaAprovacaoSection() {
  const aprovacao = await getMesAguardandoAprovacao();
  return <AlertaAprovacao mes={aprovacao?.mes ?? null} />;
}

export async function KpiRowSection() {
  const unitId = await getEffectiveUnitId();
  const kpis = await getKpis({ unitId });
  return <KpiRow kpis={kpis} />;
}

export async function CarteiraTimelineSection() {
  const unitId = await getEffectiveUnitId();
  const data = await getCarteiraTimeline(12, { unitId });
  return (
    <Section title="Evolução da carteira" subtitle="Últimos 12 meses">
      <ChartCarteiraTimelineLazy data={data} />
    </Section>
  );
}

export async function EntradaChurnSection() {
  const unitId = await getEffectiveUnitId();
  const data = await getEntradaChurn(6, { unitId });
  return (
    <Section title="Entrada vs Churn" subtitle="Últimos 6 meses">
      <ChartEntradaChurnLazy data={data} />
    </Section>
  );
}

export async function CarteiraPorAssessorSection() {
  const unitId = await getEffectiveUnitId();
  const items = await getCarteiraPorAssessor({ unitId });
  return (
    <Section title="Carteira por assessor">
      <CarteiraPorAssessorList items={items} />
    </Section>
  );
}

export async function RankingSection() {
  const unitId = await getEffectiveUnitId();
  const ranking = await getRankingSatisfacao({ unitId });
  return (
    <Section
      title="Satisfação"
      subtitle="Top 10 mais e menos satisfeitos da semana"
      cta={{ href: "/satisfacao", label: "Ver completo →" }}
    >
      <RankingResumo top={ranking.top} bottom={ranking.bottom} />
    </Section>
  );
}

export async function ProximosEventosSection() {
  const unitClientIds = await getClientIdsForActiveUnit();
  const eventos = await getProximosEventos(30, 10, { unitClientIds });
  return (
    <Section title="Próximos eventos" cta={{ href: "/calendario", label: "Ver agenda →" }}>
      <ProximosEventosList eventos={eventos} />
    </Section>
  );
}

/**
 * Remuneração pessoal do sócio (prolábore fixo em `profiles.fixo_mensal`,
 * sem parte variável). RemuneracaoCard detecta o modo "soFixo" e renderiza
 * em 2 colunas (Fixo + Total) ao invés de 3.
 */
export async function RemuneracaoSection({ userId }: { userId: string }) {
  const comissao = await getComissaoPrevista(userId, "socio");
  return <RemuneracaoCard comissao={comissao} />;
}

export function RemuneracaoSkeleton() {
  return <Skel className="h-32 sm:h-28" />;
}

/**
 * Contagem de posts do Instagram por cliente.
 * - Sócio/adm/coord: passa `assessorId=null` (vê todos da unidade).
 * - Assessor: passa o próprio `userId` (só carteira dele).
 * - Só clientes com pacote yide_360/estrategia/trafego_estrategia entram.
 */
export async function InstagramPostsSection({
  assessorId,
  titulo,
}: {
  assessorId: string | null;
  titulo?: string;
}) {
  const unitId = await getEffectiveUnitId();
  const clientes = await listClientesComUltimoSnapshot({
    unitId,
    assessorId,
  });
  // Quando assessorId !== null, é o assessor logado vendo a própria carteira:
  // o filtro de assessor não faz sentido (mostraria 1 opção só) — esconde.
  return (
    <InstagramPostsCard
      clientes={clientes}
      titulo={titulo}
      esconderFiltroAssessor={assessorId !== null}
    />
  );
}
