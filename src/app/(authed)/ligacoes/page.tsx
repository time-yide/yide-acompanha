import Link from "next/link";
import { notFound } from "next/navigation";
import { Phone, Settings } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import {
  listLigacoes,
  getMetricasGerais,
  getVolumePorDia,
  getHeatmapHorarios,
  getRankingColaboradores,
  listColaboradoresAtivos,
  getOrganizationId,
  type ListLigacoesFilter,
} from "@/lib/ligacoes/queries";
import type { StatusLigacao, TipoLigacao } from "@/lib/ligacoes/tipos";
import { STATUS_LIGACAO, TIPOS_LIGACAO } from "@/lib/ligacoes/tipos";
import { MetricasCards } from "@/components/ligacoes/MetricasCards";
import { VolumeChart } from "@/components/ligacoes/VolumeChart";
import { StatusDonut } from "@/components/ligacoes/StatusDonut";
import { HeatmapHorarios } from "@/components/ligacoes/HeatmapHorarios";
import { RankingColaboradores } from "@/components/ligacoes/RankingColaboradores";
import { LigacoesTable } from "@/components/ligacoes/LigacoesTable";
import { LigacoesToolbar } from "@/components/ligacoes/LigacoesToolbar";

const ALLOWED_ROLES = ["adm", "socio", "comercial", "coordenador", "assessor"];
const ROLES_QUE_GERENCIAM = ["adm", "socio", "comercial", "coordenador", "assessor"];

function defaultDesde(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function LigacoesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    tipo?: string;
    colaborador?: string;
    desde?: string;
    ate?: string;
    duracaoMin?: string;
    page?: string;
  }>;
}) {
  const user = await requireAuth();
  if (!ALLOWED_ROLES.includes(user.role)) notFound();
  const params = await searchParams;

  const orgId = await getOrganizationId(user.id);
  if (!orgId) notFound();

  const desde = params.desde || defaultDesde();
  const ate = params.ate || hoje();

  const status = params.status && (STATUS_LIGACAO as readonly string[]).includes(params.status)
    ? (params.status as StatusLigacao)
    : "todos";

  const tipo = params.tipo && (TIPOS_LIGACAO as readonly string[]).includes(params.tipo)
    ? (params.tipo as TipoLigacao)
    : "todos";

  const filter: ListLigacoesFilter = {
    searchQuery: params.q,
    status,
    tipo,
    colaboradorId: params.colaborador || null,
    desde,
    ate,
    duracaoMin: params.duracaoMin ? parseInt(params.duracaoMin, 10) : undefined,
    page: params.page ? parseInt(params.page, 10) : 1,
    pageSize: 50,
  };

  const [
    { ligacoes, total, page, totalPages },
    metricas,
    volumePorDia,
    heatmap,
    ranking,
    colaboradores,
  ] = await Promise.all([
    listLigacoes(orgId, filter),
    getMetricasGerais(orgId, { desde, ate }),
    getVolumePorDia(orgId, { desde, ate }),
    getHeatmapHorarios(orgId, { desde, ate }),
    getRankingColaboradores(orgId, { desde, ate }),
    listColaboradoresAtivos(orgId),
  ]);

  const canManage = ROLES_QUE_GERENCIAM.includes(user.role);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Phone className="h-6 w-6 text-primary" /> Ligações
          </h1>
          <p className="text-[11px] text-muted-foreground">
            Período: {new Date(`${desde}T12:00:00`).toLocaleDateString("pt-BR")} →{" "}
            {new Date(`${ate}T12:00:00`).toLocaleDateString("pt-BR")}
          </p>
        </div>
        <Link
          href="/ligacoes/configuracoes"
          className="inline-flex h-9 items-center gap-2 rounded-md border bg-card px-3 text-sm hover:bg-muted"
        >
          <Settings className="h-4 w-4" />
          Configurar números
        </Link>
      </header>

      {/* KPIs */}
      <MetricasCards m={metricas} />

      {/* Gráficos em grid */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <VolumeChart data={volumePorDia} />
        </div>
        <StatusDonut m={metricas} />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <HeatmapHorarios cells={heatmap} />
        <RankingColaboradores ranking={ranking} />
      </div>

      {/* Toolbar + tabela */}
      <section className="space-y-3 pt-2 border-t">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Histórico de chamadas
        </h2>
        <LigacoesToolbar
          total={total}
          ligacoesAtuais={ligacoes}
          colaboradores={colaboradores}
          canManage={canManage}
        />
        <LigacoesTable ligacoes={ligacoes} canManage={canManage} />

        {totalPages > 1 && (
          <Pagination current={page} total={totalPages} searchParams={params} />
        )}
      </section>
    </div>
  );
}

function Pagination({
  current, total, searchParams,
}: {
  current: number;
  total: number;
  searchParams: Record<string, string | undefined>;
}) {
  function pageUrl(p: number): string {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (v && k !== "page") sp.set(k, v);
    }
    sp.set("page", String(p));
    return `?${sp.toString()}`;
  }

  return (
    <div className="flex items-center justify-center gap-2 pt-2">
      <Link
        href={pageUrl(Math.max(1, current - 1))}
        aria-disabled={current <= 1}
        className={`inline-flex h-8 items-center rounded-md border bg-card px-3 text-xs hover:bg-muted ${current <= 1 ? "pointer-events-none opacity-40" : ""}`}
      >
        ← Anterior
      </Link>
      <span className="text-xs text-muted-foreground">
        Página {current} de {total}
      </span>
      <Link
        href={pageUrl(Math.min(total, current + 1))}
        aria-disabled={current >= total}
        className={`inline-flex h-8 items-center rounded-md border bg-card px-3 text-xs hover:bg-muted ${current >= total ? "pointer-events-none opacity-40" : ""}`}
      >
        Próxima →
      </Link>
    </div>
  );
}
