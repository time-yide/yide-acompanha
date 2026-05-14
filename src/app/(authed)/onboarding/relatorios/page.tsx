import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import {
  getOnboardingRelatorios,
  isValidPeriodKey,
  PERIOD_LABELS,
  type PeriodKey,
} from "@/lib/onboarding-relatorios/queries";
import { TabsOnboarding } from "@/components/onboarding/TabsOnboarding";
import { PeriodSelector } from "@/components/onboarding-relatorios/PeriodSelector";
import { FunilConversao } from "@/components/onboarding-relatorios/FunilConversao";
import { MetricCards } from "@/components/onboarding-relatorios/MetricCards";

const ROLES_PERMITIDOS = ["adm", "socio", "comercial", "assessor", "coordenador", "audiovisual_chefe"];

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const user = await requireAuth();
  if (!ROLES_PERMITIDOS.includes(user.role)) redirect("/");

  const sp = await searchParams;
  const periodKey: PeriodKey = isValidPeriodKey(sp.period) ? sp.period : "este_mes";

  const data = await getOnboardingRelatorios(periodKey);

  return (
    <div className="space-y-6">
      <TabsOnboarding active="relatorios" />

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Relatórios</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Visão analítica do funil · {PERIOD_LABELS[periodKey].toLowerCase()}
          </p>
        </div>
        <PeriodSelector current={periodKey} />
      </header>

      <FunilConversao funil={data.funil} />
      <MetricCards metricas={data.metricas} />
    </div>
  );
}
