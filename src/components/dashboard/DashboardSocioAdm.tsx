import {
  getKpis,
  getMesAguardandoAprovacao,
} from "@/lib/dashboard/queries";
import { KpiRow } from "./KpiRow";
import { AlertaAprovacao } from "./AlertaAprovacao";

interface Props {
  nome: string;
}

// Bisseção: SÓ KpiRow + AlertaAprovacao. Se quebrar, bug é numa dessas duas.
// Se funcionar, bug é nas outras (CarteiraPorAssessor, Ranking, ProximosEventos).
export async function DashboardSocioAdm({ nome }: Props) {
  const [kpis, aprovacao] = await Promise.all([
    getKpis(),
    getMesAguardandoAprovacao(),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Olá, {nome.split(" ")[0]}</h1>
        <p className="text-sm text-muted-foreground">Visão geral da agência</p>
      </header>

      <AlertaAprovacao mes={aprovacao?.mes ?? null} />

      <KpiRow kpis={kpis} />

      <p className="text-center text-xs text-muted-foreground">
        Listas e ranking temporariamente removidos enquanto isolamos um problema técnico.
      </p>
    </div>
  );
}
