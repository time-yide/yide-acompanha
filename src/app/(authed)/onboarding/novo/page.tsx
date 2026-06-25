import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { createLeadAction } from "@/lib/leads/actions";
import { LeadForm } from "@/components/onboarding/LeadForm";
import { Card } from "@/components/ui/card";

export default async function NovoLeadPage() {
  const user = await requireAuth();
  if (!["adm", "socio", "comercial"].includes(user.role)) redirect("/onboarding");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Novo prospect</h1>
        <p className="text-sm text-muted-foreground">
          Adicione um novo prospect ao kanban. Ele entra no estágio &quot;Prospecção&quot; e você pode agendar a reunião comercial.
        </p>
      </header>
      <Card className="p-6">
        <LeadForm action={createLeadAction} submitLabel="Criar prospect" />
      </Card>
    </div>
  );
}
