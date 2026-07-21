import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { Card } from "@/components/ui/card";
import { NovaPesquisaForm } from "@/components/pesquisas/NovaPesquisaForm";

export default async function NovaPesquisaPage() {
  const user = await requireAuth();
  if (!canAccess(user.role, "manage:pesquisas")) redirect("/pesquisas");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Nova pesquisa</h1>
        <p className="text-sm text-muted-foreground">Crie o rascunho; depois você adiciona as perguntas e dispara.</p>
      </header>
      <Card className="p-6">
        <NovaPesquisaForm />
      </Card>
    </div>
  );
}
