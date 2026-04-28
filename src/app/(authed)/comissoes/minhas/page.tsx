import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { CommissionTabs } from "@/components/comissoes/CommissionTabs";
import { CommissionBreakdown } from "@/components/comissoes/CommissionBreakdown";
import { HistoryTable } from "@/components/comissoes/HistoryTable";
import { listSnapshotsForUser, getMonthsAwaitingApproval } from "@/lib/comissoes/queries";
import { previewMyCommission } from "@/lib/comissoes/preview";
import { Card } from "@/components/ui/card";

function formatMonthLong(monthRef: string): string {
  const [year, month] = monthRef.split("-");
  const names = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return `${names[Number(month) - 1]} de ${year}`;
}

export default async function MinhasComissoesPage() {
  const user = await requireAuth();
  if (user.role === "socio") redirect("/comissoes/visao-geral");

  const { monthRef, result } = await previewMyCommission(user.id);
  const snapshots = await listSnapshotsForUser(user.id);
  const showVisaoGeral = canAccess(user.role, "view:other_commissions");
  const showFechamento = canAccess(user.role, "approve:monthly_closing");
  const pending = await getMonthsAwaitingApproval();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Comissões</h1>
        <p className="text-sm text-muted-foreground">
          Sua previsão atual e histórico dos últimos 12 meses.
        </p>
      </header>

      <CommissionTabs
        active="minhas"
        showVisaoGeral={showVisaoGeral}
        showFechamento={showFechamento}
        pendingMesesCount={pending.length}
      />

      <Card className="p-5 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Previsão de {formatMonthLong(monthRef)}</h2>
          <p className="text-xs text-muted-foreground">
            Esta é uma previsão. O snapshot oficial é gerado em 1º do próximo mês.
          </p>
        </div>
        {result && (
          <CommissionBreakdown
            papel={user.role}
            userId={user.id}
            monthRef={monthRef}
            fixo={result.snapshot.fixo}
            valor_variavel={result.snapshot.valor_variavel}
            base_calculo={result.snapshot.base_calculo}
            percentual_aplicado={result.snapshot.percentual_aplicado}
          />
        )}
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Histórico</h2>
        <HistoryTable snapshots={snapshots} />
      </section>
    </div>
  );
}
