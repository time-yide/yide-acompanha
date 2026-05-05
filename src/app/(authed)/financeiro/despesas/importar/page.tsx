import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { BulkExpenseImportForm } from "@/components/financeiro/BulkExpenseImportForm";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

export default async function ImportarDespesasPage() {
  const user = await requireAuth();
  if (user.role !== "socio") redirect("/");

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-2">
        <Link href="/financeiro/despesas">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="mr-1 h-4 w-4" />Voltar
          </Button>
        </Link>
      </div>
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Importar despesas em lote</h1>
        <p className="text-sm text-muted-foreground">CSV ou texto colado direto da planilha</p>
      </header>

      <BulkExpenseImportForm />
    </div>
  );
}
