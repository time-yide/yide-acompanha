import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { listColaboradores } from "@/lib/colaboradores/queries";
import { ColaboradoresTable } from "@/components/colaboradores/ColaboradoresTable";
import { ColaboradoresFilters } from "@/components/colaboradores/ColaboradoresFilters";
import { Plus } from "lucide-react";

interface SearchParams {
  role?: string;
  status?: string;
  admissao?: string;
}

function admissionAfterFromKey(key: string | undefined): string | null {
  const today = new Date();
  if (key === "30d") {
    const d = new Date(today);
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  }
  if (key === "90d") {
    const d = new Date(today);
    d.setDate(d.getDate() - 90);
    return d.toISOString().slice(0, 10);
  }
  if (key === "12m") {
    const d = new Date(today);
    d.setMonth(d.getMonth() - 12);
    return d.toISOString().slice(0, 10);
  }
  return null;
}

export default async function ColaboradoresPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const user = await requireAuth();
  const canManage = canAccess(user.role, "manage:users");
  const canSeeFinance = canAccess(user.role, "view:other_commissions");
  const canEdit = canAccess(user.role, "edit:colaboradores");
  // Mesma permissão de editar — quem pode editar pode arquivar.
  const canArchive = canEdit;

  const status = params.status ?? "ativos";
  const ativo = status === "todos" ? undefined : status === "inativos" ? false : true;
  const role = params.role && params.role !== "qualquer" ? params.role : undefined;
  const admissionAfter = admissionAfterFromKey(params.admissao);

  const rows = await listColaboradores({ ativo, role, admissionAfter });

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Colaboradores</h1>
          <p className="text-sm text-muted-foreground">{rows.length} resultado(s)</p>
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

      <ColaboradoresFilters />

      <div className="rounded-xl border bg-card">
        <ColaboradoresTable
          rows={rows}
          canSeeFinance={canSeeFinance}
          canEdit={canEdit}
          canArchive={canArchive}
          currentUserId={user.id}
        />
      </div>
    </div>
  );
}
