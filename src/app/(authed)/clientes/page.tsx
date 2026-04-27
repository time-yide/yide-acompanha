import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { listClientes, getClientesStats } from "@/lib/clientes/queries";
import { ClientesTable } from "@/components/clientes/ClientesTable";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ status?: string; imported?: string }> }) {
  const params = await searchParams;
  const user = await requireAuth();
  const canManage = ["adm", "socio"].includes(user.role);
  const canSeeMoney = ["adm", "socio"].includes(user.role);

  const status = (params.status as "ativo" | "churn" | undefined) ?? undefined;
  const rows = await listClientes({ status });
  const stats = await getClientesStats();

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            {stats.total_ativos} ativos · {stats.total_churn} em churn · carteira{" "}
            {canSeeMoney
              ? stats.carteira_total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
              : "—"}
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Link href="/clientes/importar" className={buttonVariants({ variant: "outline" })}>
              Importar em lote
            </Link>
            <Link href="/clientes/novo" className={buttonVariants()}>
              <Plus className="mr-2 h-4 w-4" />Novo cliente
            </Link>
          </div>
        )}
      </header>

      {params.imported && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          ✓ {params.imported} cliente(s) importado(s) com sucesso.
        </div>
      )}

      <div className="flex gap-2 text-sm">
        <Link href="/clientes" className={!status ? "font-semibold text-primary" : "text-muted-foreground"}>Todos</Link>
        <span className="text-muted-foreground">·</span>
        <Link href="/clientes?status=ativo" className={status === "ativo" ? "font-semibold text-primary" : "text-muted-foreground"}>Ativos</Link>
        <span className="text-muted-foreground">·</span>
        <Link href="/clientes?status=churn" className={status === "churn" ? "font-semibold text-primary" : "text-muted-foreground"}>Churn</Link>
      </div>

      <div className="rounded-xl border bg-card">
        <ClientesTable rows={rows} canSeeMoney={canSeeMoney} />
      </div>
    </div>
  );
}
