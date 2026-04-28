import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { ColaboradorCreateForm } from "@/components/colaboradores/ColaboradorCreateForm";
import { Card } from "@/components/ui/card";
import { redirect } from "next/navigation";

export default async function NovoColaboradorPage() {
  const user = await requireAuth();
  if (!canAccess(user.role, "manage:users")) redirect("/colaboradores");
  const canSetCommission = user.role === "socio";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Novo colaborador</h1>
        <p className="text-sm text-muted-foreground">
          O sistema gera uma senha aleatória e ela aparecerá uma única vez para você copiar e enviar ao colaborador.
          {!canSetCommission && " % de comissão só pode ser editado pelo sócio."}
        </p>
      </header>
      <Card className="p-6">
        <ColaboradorCreateForm canSetCommission={canSetCommission} />
      </Card>
    </div>
  );
}
