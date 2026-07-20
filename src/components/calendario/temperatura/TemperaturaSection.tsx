import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getTemperaturaForCoordinator } from "@/lib/calendario/temperatura";
import { DiasMaisCheios } from "./DiasMaisCheios";
import { CargaPorPessoa } from "./CargaPorPessoa";
import { HorariosDePico } from "./HorariosDePico";
import { Tendencia } from "./Tendencia";

export async function TemperaturaSection({ coordinatorId, weekRef }: { coordinatorId: string; weekRef: Date }) {
  const { temperatura, trend, teamMemberIds } = await getTemperaturaForCoordinator(coordinatorId, weekRef);

  // Nomes dos membros do time (fora do cache — só para exibição).
  const supabase = createServiceRoleClient();
  const { data: profs } = await supabase
    .from("profiles")
    .select("id, nome")
    .in("id", teamMemberIds.length ? teamMemberIds : ["00000000-0000-0000-0000-000000000000"]);
  const nomes: Record<string, string> = {};
  for (const p of profs ?? []) nomes[p.id] = p.nome;

  return (
    <section className="space-y-3 rounded-lg border bg-muted/20 p-4">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">🌡️ Temperatura de agenda</h2>
        <span className="text-xs text-muted-foreground">visível só para você (coordenação)</span>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <DiasMaisCheios byWeekday={temperatura.byWeekday} />
        <Tendencia trend={trend} />
        <CargaPorPessoa byPerson={temperatura.byPerson} nomes={nomes} />
        <HorariosDePico peak={temperatura.peak} />
      </div>
    </section>
  );
}
