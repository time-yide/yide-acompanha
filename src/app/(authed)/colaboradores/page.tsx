import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { listColaboradores } from "@/lib/colaboradores/queries";
import { ColaboradoresTable } from "@/components/colaboradores/ColaboradoresTable";
import { Plus } from "lucide-react";

export default async function ColaboradoresPage() {
  const user = await requireAuth();
  const canManage = canAccess(user.role, "manage:users");
  const canSeeFinance = canAccess(user.role, "view:other_commissions");
  const rows = await listColaboradores();

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Colaboradores</h1>
          <p className="text-sm text-muted-foreground">
            Equipe ativa da Yide Digital ({rows.filter((r) => r.ativo).length})
          </p>
        </div>
        {canManage && (
          <Link
            href="/colaboradores/novo"
            className="group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-primary text-primary-foreground text-sm font-medium whitespace-nowrap transition-all outline-none select-none hover:bg-primary/80 h-8 gap-1.5 px-2.5"
          >
            <Plus className="h-4 w-4" />
            Novo colaborador
          </Link>
        )}
      </header>

      <div className="rounded-xl border bg-card">
        <ColaboradoresTable rows={rows} canSeeFinance={canSeeFinance} />
      </div>
    </div>
  );
}
