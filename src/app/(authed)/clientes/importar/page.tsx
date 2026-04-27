import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { BulkImportForm } from "@/components/clientes/BulkImportForm";
import { Card } from "@/components/ui/card";

export default async function ImportarClientesPage() {
  const user = await requireAuth();
  if (!["adm", "socio"].includes(user.role)) redirect("/clientes");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Importar clientes em lote</h1>
        <p className="text-sm text-muted-foreground">
          Útil para a primeira migração. Os clientes serão criados como ativos com status &quot;ativo&quot;, sem assessor/coordenador atribuído (você atribui depois individualmente).
        </p>
      </header>
      <Card className="p-6">
        <BulkImportForm />
      </Card>
    </div>
  );
}
