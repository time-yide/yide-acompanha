import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { ConviteForm } from "@/components/colaboradores/ConviteForm";
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
          Um email de convite será enviado. O colaborador define a senha pelo link.
          {!canSetCommission && " % de comissão só pode ser editado pelo sócio."}
        </p>
      </header>
      <Card className="p-6">
        <ConviteForm canSetCommission={canSetCommission} />
      </Card>
    </div>
  );
}
