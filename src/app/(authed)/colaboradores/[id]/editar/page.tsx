import { notFound, redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { getColaboradorById } from "@/lib/colaboradores/queries";
import { ColaboradorForm } from "@/components/colaboradores/ColaboradorForm";
import { Card } from "@/components/ui/card";

export default async function EditColaboradorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();
  if (!canAccess(user.role, "edit:colaboradores")) redirect("/colaboradores");

  let colab;
  try {
    colab = await getColaboradorById(id);
  } catch {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Editar {colab.nome}</h1>
      </header>
      <Card className="p-6">
        <ColaboradorForm
          data={colab}
          canEditFinance={user.role === "socio"}
          canEditRole={user.role === "socio"}
        />
      </Card>
    </div>
  );
}
