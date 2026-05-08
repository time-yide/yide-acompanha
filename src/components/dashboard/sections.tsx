// Cada seção async puxa só sua própria query. Combinadas com <Suspense>
// no DashboardSocioAdm, o shell renderiza imediatamente (saudação + grid)
// e cada parte pesada streama quando fica pronta. Mobile sente a
// diferença: visível em ~300ms vs 2s+ da versão antiga com Promise.all
// bloqueando tudo.

import dynamic from "next/dynamic";
import {
  getKpis,
  getCarteiraTimeline,
  getEntradaChurn,
  getCarteiraPorAssessor,
  getRankingSatisfacao,
  getProximosEventos,
  getMesAguardandoAprovacao,
} from "@/lib/dashboard/queries";
import { KpiRow } from "./KpiRow";
import { CarteiraPorAssessorList } from "./CarteiraPorAssessorList";
import { RankingResumo } from "./RankingResumo";
import { ProximosEventosList } from "./ProximosEventosList";
import { AlertaAprovacao } from "./AlertaAprovacao";
import { Section } from "./Section";

// Charts via dynamic import: Recharts pesa ~150KB. Tirar do bundle
// inicial faz primeiro paint mais rápido — chart loadea em paralelo
// com o resto da página.
const ChartCarteiraTimeline = dynamic(
  () => import("./ChartCarteiraTimeline").then((m) => m.ChartCarteiraTimeline),
  { ssr: false, loading: () => <ChartSkeleton /> },
);
const ChartEntradaChurn = dynamic(
  () => import("./ChartEntradaChurn").then((m) => m.ChartEntradaChurn),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

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
  const kpis = await getKpis();
  return <KpiRow kpis={kpis} />;
}

export async function CarteiraTimelineSection() {
  const data = await getCarteiraTimeline(12);
  return (
    <Section title="Evolução da carteira" subtitle="Últimos 12 meses">
      <ChartCarteiraTimeline data={data} />
    </Section>
  );
}

export async function EntradaChurnSection() {
  const data = await getEntradaChurn(6);
  return (
    <Section title="Entrada vs Churn" subtitle="Últimos 6 meses">
      <ChartEntradaChurn data={data} />
    </Section>
  );
}

export async function CarteiraPorAssessorSection() {
  const items = await getCarteiraPorAssessor();
  return (
    <Section title="Carteira por assessor">
      <CarteiraPorAssessorList items={items} />
    </Section>
  );
}

export async function RankingSection() {
  const ranking = await getRankingSatisfacao();
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
  const eventos = await getProximosEventos(30, 10);
  return (
    <Section title="Próximos eventos" cta={{ href: "/calendario", label: "Ver agenda →" }}>
      <ProximosEventosList eventos={eventos} />
    </Section>
  );
}
