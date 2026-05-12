import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { listLeadsByStage, listLeadsPerdidos } from "@/lib/leads/queries";
import { KanbanBoard } from "@/components/onboarding/KanbanBoard";
import { OnboardingRealtimeWatcher } from "@/components/onboarding/OnboardingRealtimeWatcher";
import { buttonVariants } from "@/components/ui/button";
import { Plus, XCircle } from "lucide-react";

// LGPD: só roles que precisam operar com dados de prospect têm acesso.
const ROLES_PERMITIDOS = ["adm", "socio", "comercial", "assessor", "coordenador", "audiovisual_chefe"];

export default async function OnboardingPage() {
  const user = await requireAuth();
  if (!ROLES_PERMITIDOS.includes(user.role)) redirect("/");
  // Roda em paralelo: groups do kanban + count de perdidos pro badge.
  const [groups, perdidos] = await Promise.all([
    listLeadsByStage(),
    listLeadsPerdidos(),
  ]);

  const total =
    groups.leads_potencial.length + groups.leads_ativos.length + groups.reuniao_comercial.length +
    groups.contrato.length + groups.marco_zero.length + groups.ativo.length;

  const canCreate = ["adm", "socio", "comercial"].includes(user.role);

  return (
    <div className="space-y-5">
      {/* Kanban atualiza ao vivo quando qualquer um move/cria/marca lead. */}
      <OnboardingRealtimeWatcher />
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Onboarding</h1>
          <p className="text-sm text-muted-foreground">
            Pipeline de novos clientes · {total} lead{total !== 1 ? "s" : ""} ativo{total !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/onboarding/perdidos"
            className={buttonVariants({ variant: "outline" })}
          >
            <XCircle className="mr-2 h-4 w-4 text-rose-500" />
            Leads perdidos
            {perdidos.length > 0 && (
              <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500/15 px-1.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                {perdidos.length}
              </span>
            )}
          </Link>
          {canCreate && (
            <Link href="/onboarding/novo" className={buttonVariants()}>
              <Plus className="mr-2 h-4 w-4" />Novo prospect
            </Link>
          )}
        </div>
      </header>

      <KanbanBoard groups={groups} currentUserId={user.id} currentUserRole={user.role} />
    </div>
  );
}
