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
import { ChartCarteiraTimeline } from "./ChartCarteiraTimeline";
import { ChartEntradaChurn } from "./ChartEntradaChurn";
import { CarteiraPorAssessorList } from "./CarteiraPorAssessorList";
import { RankingResumo } from "./RankingResumo";
import { ProximosEventosList } from "./ProximosEventosList";
import { AlertaAprovacao } from "./AlertaAprovacao";
import { RemuneracaoCard } from "./RemuneracaoCard";
import { Section } from "./Section";
import { InstagramPostsCard } from "./InstagramPostsCard";
import { listClientesComUltimoSnapshot } from "@/lib/instagram-snapshots/queries";

// Charts são "use client" - Next code-splita automaticamente por rota.
// Tentei usar next/dynamic com ssr:false pra tirar do bundle inicial,
// mas Next 16 proíbe ssr:false em Server Components (e essa file é
// Server). O auto-split do "use client" já dá uma melhora menor mas
// não bloqueia o deploy. Pra reintroduzir lazy de verdade depois,
// criar wrappers client-only que façam o dynamic ali dentro.

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
      <ChartCarteiraTimeline data={data} />
    </Section>
  );
}

export async function EntradaChurnSection() {
  const unitId = await getEffectiveUnitId();
  const data = await getEntradaChurn(6, { unitId });
  return (
    <Section title="Entrada vs Churn" subtitle="Últimos 6 meses">
      <ChartEntradaChurn data={data} />
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
  return <InstagramPostsCard clientes={clientes} titulo={titulo} />;
}
