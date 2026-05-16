import { redirect } from "next/navigation";
import { Activity, Info } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { getColaboradoresStatus, summarizeStatus, listRecentEvents } from "@/lib/produtividade/queries";
import { ProdutividadeSummaryCards } from "@/components/produtividade/ProdutividadeSummaryCards";
import { ColaboradoresTable } from "@/components/produtividade/ColaboradoresTable";
import { RecentEventsFeed } from "@/components/produtividade/RecentEventsFeed";
import { AutoRefresh } from "@/components/produtividade/AutoRefresh";

const ROLES_PERMITIDOS = ["adm", "socio", "coordenador", "audiovisual_chefe"];

export const dynamic = "force-dynamic";

export default async function ProdutividadePage() {
  const user = await requireAuth();
  if (!ROLES_PERMITIDOS.includes(user.role)) redirect("/");

  const [rows, events] = await Promise.all([
    getColaboradoresStatus(),
    listRecentEvents(30),
  ]);
  const summary = summarizeStatus(rows);

  return (
    <div className="space-y-6">
      <AutoRefresh intervalSeconds={30} />

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Produtividade</h1>
            <p className="text-sm text-muted-foreground">
              Atividade em tempo real, ranking e custo da equipe — atualiza a cada 30s.
            </p>
          </div>
        </div>
      </header>

      <ProdutividadeSummaryCards summary={summary} />

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Colaboradores · hoje
        </h2>
        <ColaboradoresTable rows={rows} />
      </section>

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
              <strong className="text-foreground">Tempo ativo:</strong> soma das
              sessões contínuas de eventos (gap de 10 min encerra sessão).
            </p>
            <p>
              <strong className="text-foreground">Custo/hora:</strong>{" "}
              calculado de <code>fixo_mensal + média de comissão (3 meses)</code>{" "}
              dividido por 176h (22 dias × 8h). Sem dados de comissão paga,
              usa só o fixo.
            </p>
            <p className="mt-2 rounded-md bg-muted/40 p-2 text-[10px]">
              Monitoramento de apps do desktop, mouse/teclado e ociosidade
              exige app nativo (Tauri/Electron) — Fase 3 do roadmap.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
