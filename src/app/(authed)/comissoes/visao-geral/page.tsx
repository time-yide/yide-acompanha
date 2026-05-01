import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { CommissionTabs } from "@/components/comissoes/CommissionTabs";
import { OverviewTable } from "@/components/comissoes/OverviewTable";
import { listSnapshotsForMonth, getMonthsAwaitingApproval } from "@/lib/comissoes/queries";
import { previewAllForMonth } from "@/lib/comissoes/preview";

function defaultMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLong(monthRef: string): string {
  const [year, month] = monthRef.split("-");
  const names = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return `${names[Number(month) - 1]} de ${year}`;
}

export default async function VisaoGeralPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const params = await searchParams;
  const user = await requireAuth();
  if (!canAccess(user.role, "view:other_commissions")) notFound();

  const showFechamento = canAccess(user.role, "approve:monthly_closing");
  const pending = await getMonthsAwaitingApproval();
  const monthRef = params.mes && /^\d{4}-\d{2}$/.test(params.mes) ? params.mes : defaultMonth();
  const snapshots = await listSnapshotsForMonth(monthRef);
  const isPreview = snapshots.length === 0;
  const rows = isPreview ? await previewAllForMonth(monthRef) : snapshots;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Comissões</h1>
        <p className="text-sm text-muted-foreground">
          Visão consolidada de todos os colaboradores.
        </p>
      </header>

      <CommissionTabs
        active="visao-geral"
        showVisaoGeral={true}
        showFechamento={showFechamento}
        pendingMesesCount={pending.length}
      />

      {pending.length > 0 && showFechamento && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          ⚠ {pending.length} mês{pending.length === 1 ? "" : "es"} aguardando aprovação:{" "}
          <Link href="/comissoes/fechamento" className="text-primary hover:underline font-medium">
            ir para Fechamento →
          </Link>
        </div>
      )}

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Mês:</span>
        <span className="text-sm">{formatMonthLong(monthRef)}</span>
        {isPreview && (
          <span className="inline-flex rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-600 dark:text-sky-400">
            Preview ao vivo (mês ainda não fechado)
          </span>
        )}
      </div>

      <OverviewTable rows={rows as unknown as Parameters<typeof OverviewTable>[0]["rows"]} />
    </div>
  );
}
