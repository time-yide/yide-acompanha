import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getTemperaturaForCoordinator, type TempPeriod } from "@/lib/calendario/temperatura";
import { DiasMaisCheios } from "./DiasMaisCheios";
import { CargaPorPessoa } from "./CargaPorPessoa";
import { HorariosDePico } from "./HorariosDePico";
import { Tendencia } from "./Tendencia";

export async function TemperaturaSection({
  coordinatorId,
  refDate,
  period,
}: {
  coordinatorId: string;
  refDate: Date;
  period: TempPeriod;
}) {
  const { temperatura, trend, teamMemberIds } = await getTemperaturaForCoordinator(
    coordinatorId,
    refDate,
    period,
  );

  // Nomes dos membros do time (fora do cache — só para exibição).
  const supabase = createServiceRoleClient();
  const { data: profs } = await supabase
    .from("profiles")
    .select("id, nome")
    .in("id", teamMemberIds.length ? teamMemberIds : ["00000000-0000-0000-0000-000000000000"]);
  const nomes: Record<string, string> = {};
  for (const p of profs ?? []) nomes[p.id] = p.nome;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <DiasMaisCheios byWeekday={temperatura.byWeekday} />
      <Tendencia trend={trend} />
      <CargaPorPessoa byPerson={temperatura.byPerson} nomes={nomes} />
      <HorariosDePico peakByHour={temperatura.peakByHour} />
    </div>
  );
}
