import { CalendarDays, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { listWeeklyReportsByClient } from "@/lib/weekly-reports/queries";
import type { MetricaComparacao, WeeklyReportRow } from "@/lib/weekly-reports/types";

function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function VariacaoIndicator({ variacao }: { variacao: number }) {
  if (variacao > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
        <TrendingUp className="h-3 w-3" />
        +{variacao}%
      </span>
    );
  }
  if (variacao < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-red-600 dark:text-red-400">
        <TrendingDown className="h-3 w-3" />
        {variacao}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground">
      <Minus className="h-3 w-3" />
      0%
    </span>
  );
}

function MetricaItem({ label, metrica }: { label: string; metrica: MetricaComparacao }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold">{metrica.valor.toLocaleString("pt-BR")}</span>
        <VariacaoIndicator variacao={metrica.variacao_pct} />
      </div>
    </div>
  );
}

function ReportCard({ report }: { report: WeeklyReportRow }) {
  const dados = report.dados;
  const periodo = `${formatDateBR(report.semana_inicio)} a ${formatDateBR(report.semana_fim)}`;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">{periodo}</span>
        </div>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
          {dados.posts_publicados} post{dados.posts_publicados !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="mt-3 space-y-1.5">
        <MetricaItem label="Alcance" metrica={dados.metricas.alcance} />
        <MetricaItem label="Curtidas" metrica={dados.metricas.curtidas} />
        <MetricaItem label="Comentários" metrica={dados.metricas.comentarios} />
        <MetricaItem label="Salvamentos" metrica={dados.metricas.salvamentos} />
        <MetricaItem label="Compartilhamentos" metrica={dados.metricas.compartilhamentos} />
        <div className="border-t pt-1.5">
          <MetricaItem label="Engajamento total" metrica={dados.metricas.engajamento_total} />
        </div>
      </div>

      {dados.posts_detalhes.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-primary hover:underline">
            Ver posts publicados
          </summary>
          <ul className="mt-2 space-y-1">
            {dados.posts_detalhes.map((post, i) => (
              <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase">
                  {post.rede}
                </span>
                <span className="truncate">{post.titulo || "Sem título"}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export async function RelatoriosSemanaisSection({ clientId }: { clientId: string }) {
  const reports = await listWeeklyReportsByClient(clientId);

  if (reports.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-2xl border bg-card">
      <div className="bg-gradient-to-br from-primary/10 via-card to-card p-6 sm:p-8">
        <header className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <CalendarDays className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider">Relatórios Semanais</h2>
            <p className="text-xs text-muted-foreground">Desempenho das suas redes sociais</p>
          </div>
        </header>

        <div className="mt-5 space-y-3">
          {reports.map((r) => (
            <ReportCard key={r.id} report={r} />
          ))}
        </div>
      </div>
    </section>
  );
}
