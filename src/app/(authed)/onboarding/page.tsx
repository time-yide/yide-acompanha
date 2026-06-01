import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { listLeadsByStage } from "@/lib/leads/queries";
import { getProfileIdsForActiveUnit } from "@/lib/units/filter-helpers";
import { listColaboradores } from "@/lib/colaboradores/queries";
import { KanbanBoard } from "@/components/onboarding/KanbanBoard";
import { OnboardingRealtimeWatcher } from "@/components/onboarding/OnboardingRealtimeWatcher";
import { TabsOnboarding } from "@/components/onboarding/TabsOnboarding";
import { TabsOnboardingProspeccao } from "@/components/onboarding/TabsOnboardingProspeccao";
import { buttonVariants } from "@/components/ui/button";
import { Plus, Download } from "lucide-react";

// LGPD: só roles que precisam operar com dados de prospect têm acesso.
const ROLES_PERMITIDOS = ["adm", "socio", "comercial", "assessor", "coordenador", "audiovisual_chefe"];

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ canal?: string }> }) {
  const user = await requireAuth();
  if (!ROLES_PERMITIDOS.includes(user.role)) redirect("/");

  const { canal: canalRaw } = await searchParams;
  const canal = canalRaw === "rua" || canalRaw === "ligacao" ? canalRaw : undefined;

  // Multi-tenant: filtra leads pelos profiles da unidade ativa
  const unitProfileIds = await getProfileIdsForActiveUnit();
  const [groups, coordenadoresRaw, assessoresRaw] = await Promise.all([
    listLeadsByStage(unitProfileIds, canal),
    // "Coordenador" no UI cobre adm/socio/coordenador - Yasmin opera como
    // sócia, mas alguns profiles antigos podem estar como adm.
    listColaboradores({ ativo: true, roles: ["adm", "socio", "coordenador"] }),
    listColaboradores({ ativo: true, role: "assessor" }),
  ]);
  const coordenadores = coordenadoresRaw.map((c) => ({ id: c.id, nome: c.nome }));
  const assessores = assessoresRaw.map((a) => ({ id: a.id, nome: a.nome }));

  const total =
    groups.leads_potencial.length + groups.leads_ativos.length + groups.reuniao_comercial.length +
    groups.contrato.length + groups.marco_zero.length + groups.ativo.length;

  const canCreate = ["adm", "socio", "comercial"].includes(user.role);

  const canalLabel = canal === "rua" ? "Rua" : canal === "ligacao" ? "Ligação" : "Todos";
  const novoHref = canal ? `/onboarding/novo?canal=${canal}` : "/onboarding/novo";

  return (
    <div className="space-y-5">
      {/* Kanban atualiza ao vivo quando qualquer um move/cria/marca lead. */}
      <OnboardingRealtimeWatcher />
      <TabsOnboardingProspeccao active="onboarding" />
      <TabsOnboarding active="kanban" />
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Onboarding</h1>
          <p className="text-sm text-muted-foreground">
            Pipeline de novos clientes · Canal: {canalLabel} · {total} lead{total !== 1 ? "s" : ""} ativo{total !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canCreate && (
            <>
              <Link
                href="/onboarding/importar"
                className={buttonVariants({ variant: "outline" })}
                title="Importar cliente já cadastrado no sistema (sem duplicar)"
              >
                <Download className="mr-2 h-4 w-4" />
                Importar cliente
              </Link>
              <Link href={novoHref} className={buttonVariants()}>
                <Plus className="mr-2 h-4 w-4" />Novo prospect
              </Link>
            </>
          )}
        </div>
      </header>

      <KanbanBoard groups={groups} currentUserId={user.id} currentUserRole={user.role} coordenadores={coordenadores} assessores={assessores} />
    </div>
  );
}
