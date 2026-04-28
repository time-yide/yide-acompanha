import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { CommissionTabs } from "@/components/comissoes/CommissionTabs";
import { FechamentoTable } from "@/components/comissoes/FechamentoTable";
import { ApproveMonthButton } from "@/components/comissoes/ApproveMonthButton";
import { listSnapshotsForMonth, getMonthsAwaitingApproval } from "@/lib/comissoes/queries";

function formatMonthLong(monthRef: string): string {
  const [year, month] = monthRef.split("-");
  const names = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return `${names[Number(month) - 1]} de ${year}`;
}

export default async function FechamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const params = await searchParams;
  const user = await requireAuth();
  if (!canAccess(user.role, "approve:monthly_closing")) notFound();

  const pending = await getMonthsAwaitingApproval();

  let monthRef = params.mes && /^\d{4}-\d{2}$/.test(params.mes) ? params.mes : null;
  if (!monthRef) {
    if (pending.length > 0) monthRef = pending[0];
    else {
      const now = new Date();
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      monthRef = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
    }
  }

  const rows = (await listSnapshotsForMonth(monthRef)) as unknown as Parameters<typeof FechamentoTable>[0]["rows"];
  const pendingThisMonth = rows.filter((r) => r.status === "pending_approval");
  const hasNegative = pendingThisMonth.some((r) => Number(r.valor_total) < 0);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Fechamento de comissões</h1>
        <p className="text-sm text-muted-foreground">
          Revise e aprove a folha do mês.
        </p>
      </header>

      <CommissionTabs
        active="fechamento"
        showVisaoGeral={true}
        showFechamento={true}
        pendingMesesCount={pending.length}
      />

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Mês:</span>
        <span className="text-sm">{formatMonthLong(monthRef)}</span>
        <span className="text-xs text-muted-foreground">
          ({pendingThisMonth.length} pendente{pendingThisMonth.length === 1 ? "" : "s"})
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          Nenhum snapshot neste mês.
        </p>
      ) : (
        <>
          <FechamentoTable rows={rows} />
          {pendingThisMonth.length > 0 && (
            <div className="border-t pt-5">
              <ApproveMonthButton
                monthRef={monthRef}
                monthLabel={formatMonthLong(monthRef)}
                count={pendingThisMonth.length}
                hasNegative={hasNegative}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
