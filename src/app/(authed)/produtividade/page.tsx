import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, Info, AlertTriangle, ChevronRight } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { TabsColaboradores } from "@/components/colaboradores/TabsColaboradores";
import {
  getColaboradoresStatus,
  getEntregaMaterialStats,
  getPrazoAgilidade,
  getQualidadeSetor,
  summarizeStatus,
  listRecentEvents,
  PERIODO_LABEL,
  type PeriodoRange,
} from "@/lib/produtividade/queries";
import { PrazoAgilidadeSection } from "@/components/produtividade/PrazoAgilidadeSection";
import { QualidadeSetorSection } from "@/components/produtividade/QualidadeSetorSection";
import { ProdutividadeSummaryCards } from "@/components/produtividade/ProdutividadeSummaryCards";
import { ColaboradoresTable } from "@/components/produtividade/ColaboradoresTable";
import { getProdutividadeSetor } from "@/lib/produtividade/setor-metricas-server";
import { ProdutividadeSetorSection } from "@/components/produtividade/ProdutividadeSetorSection";
import { TimeAudiovisualCard } from "@/components/produtividade/TimeAudiovisualCard";
import { EntregaMaterialSection } from "@/components/produtividade/EntregaMaterialSection";
import { RecentEventsFeed } from "@/components/produtividade/RecentEventsFeed";
import { AutoRefresh } from "@/components/produtividade/AutoRefresh";
import { PeriodoFilter } from "@/components/produtividade/PeriodoFilter";

const ROLES_PERMITIDOS = ["adm", "socio", "coordenador", "audiovisual_chefe"];

export const dynamic = "force-dynamic";

const VALID_RANGES: PeriodoRange[] = ["dia", "semana", "mes"];

export default async function ProdutividadePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const user = await requireAuth();
  if (!ROLES_PERMITIDOS.includes(user.role)) redirect("/");

  const { range: rangeParam } = await searchParams;
  const range: PeriodoRange = VALID_RANGES.includes(rangeParam as PeriodoRange)
    ? (rangeParam as PeriodoRange)
    : "dia";

  const [statusResult, entregaMaterial, events, setorResult, prazoAgilidade, qualidade] = await Promise.all([
    getColaboradoresStatus(range),
    getEntregaMaterialStats(range),
    listRecentEvents(30),
    getProdutividadeSetor(range),
    getPrazoAgilidade(range),
    getQualidadeSetor(range),
  ]);
  const { rows, faturamento_periodo, time_audiovisual } = statusResult;
  const summary = summarizeStatus(rows, faturamento_periodo);
  // Coordenador de audiovisual não vê nada financeiro (custo/receita/lucro).
  const mostrarFinanceiro = user.role !== "audiovisual_chefe";

  // Top 5 com mais atrasados - destaque pra coord agir
  const comAtraso = rows
    .filter((r) => r.tarefas_atrasadas + r.capturas_atrasadas > 0)
    .sort(
      (a, b) =>
        b.tarefas_atrasadas + b.capturas_atrasadas - (a.tarefas_atrasadas + a.capturas_atrasadas),
    )
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <TabsColaboradores active="produtividade" canSeeProdutividade />
      <AutoRefresh intervalSeconds={30} />

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Produtividade</h1>
            <p className="text-sm text-muted-foreground">
              Atividade em tempo real, ranking e produtividade da equipe - atualiza a cada 30s.
            </p>
          </div>
        </div>
        <PeriodoFilter current={range} />
      </header>

      <ProdutividadeSummaryCards summary={summary} periodoLabel={PERIODO_LABEL[range]} mostrarFinanceiro={mostrarFinanceiro} />

      {comAtraso.length > 0 && (
        <section className="rounded-xl border border-rose-500/30 bg-rose-500/[0.04] p-4">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-300">
              Quem está com atrasos
            </h2>
          </div>
          <ul className="space-y-1.5">
            {comAtraso.map((r) => {
              const total = r.tarefas_atrasadas + r.capturas_atrasadas;
              // Link "principal" da linha aponta pro recurso com mais atraso -
              // tarefas tem URL filtrável por usuário; capturas tem só a aba.
              const primaryHref =
                r.tarefas_atrasadas >= r.capturas_atrasadas
                  ? `/tarefas?aba=todas&view=list&atribuido=${r.user_id}`
                  : `/audiovisual?tab=pendente_entrega`;
              return (
                <li key={r.user_id}>
                  <Link
                    href={primaryHref}
                    className="group flex items-center justify-between gap-3 rounded-md bg-card/60 px-3 py-2 text-sm transition-colors hover:bg-card"
                  >
                    <span className="font-medium">{r.nome}</span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {r.tarefas_atrasadas > 0 && (
                        <span className="underline-offset-2 group-hover:underline">
                          {r.tarefas_atrasadas} tarefa{r.tarefas_atrasadas === 1 ? "" : "s"}
                        </span>
                      )}
                      {r.capturas_atrasadas > 0 && (
                        <span className="underline-offset-2 group-hover:underline">
                          {r.capturas_atrasadas} captura{r.capturas_atrasadas === 1 ? "" : "s"}
                        </span>
                      )}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-rose-500/20 px-2 text-xs font-bold tabular-nums text-rose-700 dark:text-rose-300">
                        {total}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[10px] text-muted-foreground">
            Clica numa linha pra abrir as tarefas atrasadas dessa pessoa (ou aba de capturas pendentes).
          </p>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Colaboradores · {PERIODO_LABEL[range]}
        </h2>
        {mostrarFinanceiro && time_audiovisual && (
          <div className="mb-3">
            <TimeAudiovisualCard time={time_audiovisual} />
          </div>
        )}
        <ColaboradoresTable rows={rows} produtividade={setorResult.porUsuario} mostrarFinanceiro={mostrarFinanceiro} />
      </section>

      <PrazoAgilidadeSection pessoas={prazoAgilidade.pessoas} resumo={prazoAgilidade.resumo} />

      <QualidadeSetorSection assessoria={qualidade.assessoria} design={qualidade.design} />

      <ProdutividadeSetorSection setores={setorResult.setores} />
      <EntregaMaterialSection rows={entregaMaterial} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentEventsFeed events={events} />
        </div>

        <aside className="space-y-3 rounded-xl border bg-card p-4 text-sm">
          <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400">
            <Info className="h-4 w-4" />
            <h3 className="text-xs font-semibold uppercase tracking-wider">Como funciona</h3>
          </div>
          <div className="space-y-2 text-xs text-muted-foreground">
            <p>
              <strong className="text-foreground">Online:</strong> heartbeat do
              navegador nos últimos 2 min (aba aberta conta).
            </p>
            <p>
              <strong className="text-foreground">Ativo:</strong> ação real no
              sistema (criar tarefa, mudar status, etc) nos últimos 5 min.
            </p>
            <p>
              <strong className="text-foreground">Tempo ativo:</strong> presença
              real medida pelo heartbeat (cada minuto com a aba aberta e em foco
              conta){" "}
              <strong className="text-fuchsia-600 dark:text-fuchsia-400">+ duração das gravações</strong>{" "}
              (creditada a todos que foram na captura, como tempo produtivo).
            </p>
            <p>
              <strong className="text-foreground">Tempo pra entregar:</strong>{" "}
              tempo entre o fim da gravação e a pessoa subir o material no Drive —
              média, mais lenta e pendentes (gravou e não subiu).
            </p>
            <p>
              <strong className="text-foreground">Atrasados:</strong> tarefas
              não concluídas com prazo vencido + capturas de videomaker que
              passaram da deadline (D+1 às 9h) sem entrega.
            </p>
            {mostrarFinanceiro && (
              <>
                <p>
                  <strong className="text-foreground">Custo do período:</strong>{" "}
                  salário fixo que se paga de fato —{" "}
                  <code>(fixo_mensal ÷ 22 dias úteis) × dias úteis decorridos</code>,
                  independente de atividade.
                </p>
                <p>
                  <strong className="text-foreground">Receita / Lucro:</strong>{" "}
                  faturamento do período (carteira ativa pró-rata) ÷ total de entregas
                  = valor por entrega. Receita = valor × entregas da pessoa; lucro =
                  receita − custo do salário.
                </p>
                <p>
                  <strong className="text-foreground">Time Audiovisual:</strong>{" "}
                  o coordenador é medido pelo time — lucro = receita dos produtores −
                  (custo deles + salário do coordenador). Coordenador geral e sócia
                  ficam fora do cálculo.
                </p>
              </>
            )}
            <p className="mt-2 rounded-md bg-muted/40 p-2 text-[10px]">
              Monitoramento de apps do desktop, mouse/teclado e ociosidade
              exige app nativo (Tauri/Electron) - Fase 3 do roadmap.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
