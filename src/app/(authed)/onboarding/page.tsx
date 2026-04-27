import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { listLeadsByStage } from "@/lib/leads/queries";
import { KanbanBoard } from "@/components/onboarding/KanbanBoard";
import { buttonVariants } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default async function OnboardingPage() {
  const user = await requireAuth();
  const groups = await listLeadsByStage();

  const total =
    groups.prospeccao.length + groups.comercial.length +
    groups.contrato.length + groups.marco_zero.length + groups.ativo.length;

  const canCreate = ["adm", "socio", "comercial"].includes(user.role);

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Onboarding</h1>
          <p className="text-sm text-muted-foreground">
            Pipeline de novos clientes · {total} lead{total !== 1 ? "s" : ""} ativo{total !== 1 ? "s" : ""}
          </p>
        </div>
        {canCreate && (
          <Link href="/onboarding/novo" className={buttonVariants()}>
            <Plus className="mr-2 h-4 w-4" />Novo prospect
          </Link>
        )}
      </header>

      <KanbanBoard groups={groups} />
    </div>
  );
}
