import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { listExpenses } from "@/lib/financeiro/queries";
import { ExpenseTable } from "@/components/financeiro/ExpenseTable";
import { ExpenseFilters } from "@/components/financeiro/ExpenseFilters";
import DespesasShell from "./_DespesasShell";
import type { ExpenseCategoria, ExpenseTipo } from "@/lib/financeiro/schema";

interface SearchParams {
  tipo?: string;
  categoria?: string;
  mes?: string;
}

const TIPOS: ExpenseTipo[] = ["fixa", "avulsa"];

export default async function DespesasPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const user = await requireAuth();
  if (user.role !== "socio") redirect("/");

  const tipo = TIPOS.includes(params.tipo as ExpenseTipo) ? (params.tipo as ExpenseTipo) : undefined;
  const categoria = params.categoria && params.categoria !== "qualquer" ? (params.categoria as ExpenseCategoria) : undefined;
  const mes = params.mes && /^\d{4}-\d{2}$/.test(params.mes) ? params.mes : undefined;

  const rows = await listExpenses({ tipo, categoria, mes_referencia: mes });

  const fixas = rows.filter((r) => r.tipo === "fixa");
  const avulsas = rows.filter((r) => r.tipo === "avulsa");

  return (
    <div className="space-y-5">
      <DespesasShell>
        <ExpenseFilters />

        {(!tipo || tipo === "fixa") && (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Fixas · {fixas.length}</h3>
            <ExpenseTable rows={fixas} />
          </section>
        )}

        {(!tipo || tipo === "avulsa") && (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Avulsas · {avulsas.length}</h3>
            <ExpenseTable rows={avulsas} />
          </section>
        )}
      </DespesasShell>
    </div>
  );
}
