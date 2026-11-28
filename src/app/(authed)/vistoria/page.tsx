import { requireAuth } from "@/lib/auth/session";
import { getTodayDate } from "@/lib/datetime/timezone";
import { resolverSemana, rotuloSemana } from "@/lib/check/core";
import { podeGerenciarVistoria } from "@/lib/vistoria/core";
import { getExigirComprovacao, getMinhaVistoria, listConferenciaSemana, listEquipamentos, listLeiturasSemana, listPessoasAtivas } from "@/lib/vistoria/queries";
import { TabsManual } from "@/components/manual/TabsManual";
import { podeVerColaboradores } from "@/lib/colaboradores/access";
import { MinhaVistoria } from "@/components/vistoria/MinhaVistoria";
import { VistoriaGestao } from "@/components/vistoria/VistoriaGestao";
import { ScanLine } from "lucide-react";

export default async function VistoriaPage() {
  const user = await requireAuth();
  const semana = resolverSemana(null, getTodayDate());
  const semanaLabel = rotuloSemana(semana);
  const gestor = podeGerenciarVistoria(user.role);

  const [minha, equipamentos, pessoas, conferencia, leituras, exigirComprovacao] = await Promise.all([
    getMinhaVistoria(user.id, semana),
    gestor ? listEquipamentos() : Promise.resolve([]),
    gestor ? listPessoasAtivas() : Promise.resolve([]),
    gestor ? listConferenciaSemana(semana) : Promise.resolve([]),
    gestor ? listLeiturasSemana(semana) : Promise.resolve([]),
    getExigirComprovacao(),
  ]);

  return (
    <div className="space-y-8">
      <TabsManual active="vistoria" canVerColaboradores={podeVerColaboradores(user.role)} />
      <header className="overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/15 via-card to-card p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <ScanLine className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Vistoria</h1>
            <p className="text-sm text-muted-foreground">
              Estoque de equipamentos e conferência semanal por QR code
            </p>
          </div>
        </div>
      </header>

      <MinhaVistoria
        semanaLabel={semanaLabel}
        equipamentos={minha.equipamentos}
        lidosIds={minha.lidosIds}
        concluida={Boolean(minha.concluidaEm)}
        exigirComprovacao={exigirComprovacao}
      />

      {gestor && (
        <VistoriaGestao
          equipamentos={equipamentos}
          pessoas={pessoas}
          conferencia={conferencia}
          leituras={leituras}
          exigirComprovacao={exigirComprovacao}
          semanaLabel={semanaLabel}
        />
      )}
    </div>
  );
}
