// Cada seção async puxa só sua própria query. Combinadas com <Suspense>
// no DashboardSocioAdm, o shell renderiza imediatamente (saudação + grid)
// e cada parte pesada streama quando fica pronta. Mobile sente a
// diferença: visível em ~300ms vs 2s+ da versão antiga com Promise.all
// bloqueando tudo.

import {
  getKpis,
  getCarteiraTimeline,
  getEntradaChurn,
  getChurnMotivos,
  getCarteiraPorAssessor,
  getRankingSatisfacao,
  getProximosEventos,
  getMesAguardandoAprovacao,
} from "@/lib/dashboard/queries";
import { getEffectiveUnitId } from "@/lib/units/session";
import { getCurrentMonthYM } from "@/lib/datetime/timezone";
import { getClientIdsForActiveUnit } from "@/lib/units/filter-helpers";
import { getComissaoPrevista } from "@/lib/dashboard/comissao-prevista";
import { getChurnMensalHistorico } from "@/lib/dashboard/churn-historico";
import { KpiRow } from "./KpiRow";
import { ChartCarteiraTimelineLazy } from "./ChartCarteiraTimelineLazy";
import { ChartEntradaChurnLazy } from "./ChartEntradaChurnLazy";
import { ChartChurnMotivosLazy } from "./ChartChurnMotivosLazy";
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

// `mes` ('YYYY-MM') opcional: quando omitido, queries caem no mês corrente
// (mesmo comportamento de antes). Passado pelo DashboardSocioAdm a partir do
// MesSelector pra re-escopar KPIs/gráficos a um mês fechado.
export async function KpiRowSection({ mes }: { mes?: string }) {
  const unitId = await getEffectiveUnitId();
  const [kpis, churnHistorico] = await Promise.all([
    getKpis({ unitId }, mes),
    getChurnMensalHistorico({ unitId }, mes),
  ]);
  return <KpiRow kpis={kpis} churnHistorico={churnHistorico} />;
}

export async function CarteiraTimelineSection({ mes }: { mes?: string }) {
  const unitId = await getEffectiveUnitId();
  const data = await getCarteiraTimeline(12, { unitId }, mes);
  return (
    <Section title="Evolução da carteira" subtitle="Últimos 12 meses">
      <ChartCarteiraTimelineLazy data={data} />
    </Section>
  );
}

export async function EntradaChurnSection({ mes }: { mes?: string }) {
  const unitId = await getEffectiveUnitId();
  const anoAtual = Number((mes ?? getCurrentMonthYM()).slice(0, 4));
  const anos = [2024, 2025, 2026].filter((a) => a <= anoAtual);
  const entries = await Promise.all(
    anos.map(async (ano) => {
      // Ano cheio (jan–dez) ancorado em dezembro; meses futuros vêm zerados.
      const pts = await getEntradaChurn(12, { unitId }, `${ano}-12`);
      return [String(ano), pts] as const;
    }),
  );
  const porAno = Object.fromEntries(entries);
  return (
    <Section title="Entrada vs Churn" subtitle="Por ano">
      <ChartEntradaChurnLazy porAno={porAno} />
    </Section>
  );
}

export async function MotivosChurnSection({ mes }: { mes?: string }) {
  const unitId = await getEffectiveUnitId();
  const data = await getChurnMotivos(6, { unitId }, mes);
  return (
    <Section title="Motivos de churn" subtitle="Últimos 6 meses">
      <ChartChurnMotivosLazy data={data} />
    </Section>
  );
}

export async function CarteiraPorAssessorSection({ mes }: { mes?: string }) {
  const unitId = await getEffectiveUnitId();
  const items = await getCarteiraPorAssessor({ unitId }, mes);
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
  // Prolábore do sócio é sempre o mês corrente (em curso); não tem histórico aqui.
  return <RemuneracaoCard comissao={{ ...comissao, status: "em_curso" }} />;
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
  exigirSelecaoAssessor = false,
}: {
  assessorId: string | null;
  titulo?: string;
  /** Coordenador/sócio: não despeja a lista inteira — começa sem assessor
   * selecionado e só mostra as postagens depois de escolher um no filtro. */
  exigirSelecaoAssessor?: boolean;
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
      exigirSelecaoAssessor={exigirSelecaoAssessor}
    />
  );
}
