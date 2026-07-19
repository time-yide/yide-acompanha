import { redirect } from "next/navigation";
import Link from "next/link";
import { Activity, Info, Gauge, ArrowRight } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { TabsColaboradores } from "@/components/colaboradores/TabsColaboradores";
import {
  getColaboradoresStatus,
  getEntregaMaterialStats,
  getPrazoAgilidade,
  getQualidadeSetor,
  getConversaoComercial,
  getConsistencia,
  summarizeStatus,
  listRecentEvents,
  resolvePeriodoRange,
  PERIODO_LABEL,
  type PeriodoRange,
  type Periodo,
} from "@/lib/produtividade/queries";
import { formatIsoDate } from "@/lib/datetime/timezone";
import { PrazoAgilidadeSection } from "@/components/produtividade/PrazoAgilidadeSection";
import { QualidadeSetorSection } from "@/components/produtividade/QualidadeSetorSection";
import { ConversaoComercialSection } from "@/components/produtividade/ConversaoComercialSection";
import { ConsistenciaSection } from "@/components/produtividade/ConsistenciaSection";
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
  searchParams: Promise<{ range?: string; de?: string; ate?: string }>;
}) {
  const user = await requireAuth();
  if (!ROLES_PERMITIDOS.includes(user.role)) redirect("/");

  const { range: rangeParam, de: deParam, ate: ateParam } = await searchParams;
  const range: PeriodoRange = VALID_RANGES.includes(rangeParam as PeriodoRange)
    ? (rangeParam as PeriodoRange)
    : "dia";

  // Período: datas custom (De/Até válidas) têm prioridade; senão o botão rápido.
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const customValido = !!(deParam && ateParam && DATE_RE.test(deParam) && DATE_RE.test(ateParam) && deParam <= ateParam);
  const periodo: Periodo = customValido
    ? { de: deParam!, ate: ateParam! }
    : resolvePeriodoRange(range, formatIsoDate(new Date()));
  const fmtBr = (iso: string) => iso.split("-").reverse().join("/");
  const periodoLabel = customValido ? `${fmtBr(periodo.de)} – ${fmtBr(periodo.ate)}` : PERIODO_LABEL[range];

  const [statusResult, entregaMaterial, events, setorResult, prazoAgilidade, qualidade, conversao, consistencia] = await Promise.all([
    getColaboradoresStatus(periodo),
    getEntregaMaterialStats(periodo),
    listRecentEvents(30),
    getProdutividadeSetor(periodo),
    getPrazoAgilidade(periodo),
    getQualidadeSetor(periodo),
    getConversaoComercial(periodo),
    getConsistencia(periodo),
  ]);
  const { rows, faturamento_periodo, time_audiovisual } = statusResult;
  const summary = summarizeStatus(rows, faturamento_periodo);
  // Coordenador de audiovisual não vê nada financeiro (custo/receita/lucro).
  const mostrarFinanceiro = user.role !== "audiovisual_chefe";

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
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/produtividade/capacidade"
            className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          >
            <Gauge className="h-4 w-4" /> Capacidade <ArrowRight className="h-4 w-4" />
          </Link>
          <PeriodoFilter range={range} de={customValido ? periodo.de : undefined} ate={customValido ? periodo.ate : undefined} />
        </div>
      </header>

      <ProdutividadeSummaryCards summary={summary} periodoLabel={periodoLabel} mostrarFinanceiro={mostrarFinanceiro} />

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Colaboradores · {periodoLabel}
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

      <ConversaoComercialSection pessoas={conversao} />

      <ConsistenciaSection pessoas={consistencia.pessoas} diasUteis={consistencia.diasUteis} />

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
