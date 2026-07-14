import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import {
  listClientesEmOnboarding,
  listClientesElegiveisParaOnboarding,
} from "@/lib/d0-d30/queries";
import { D0D30Table } from "@/components/d0-d30/D0D30Table";
import { TabsSocialMedia } from "@/components/social-media/TabsSocialMedia";

const ROLES_QUE_VEEM = ["adm", "socio", "coordenador", "assessor", "comercial"];

export default async function D0D30Page() {
  const user = await requireAuth();
  if (!ROLES_QUE_VEEM.includes(user.role)) notFound();

  const canManage = ["adm", "socio", "coordenador"].includes(user.role);

  const [resumos, elegiveis] = await Promise.all([
    listClientesEmOnboarding(),
    canManage
      ? listClientesElegiveisParaOnboarding()
      : Promise.resolve([] as Array<{ id: string; nome: string; data_entrada: string }>),
  ]);

  // Filtra por permissão: se for assessor/comercial, mostra só onde ele é responsável.
  // (RLS no banco já garante isso, mas filtramos no service-role pra UI ser consistente.)
  // TODO: passar o user.id e fazer o filtro aqui se precisar refinar.

  const counts = {
    total: resumos.length,
    atrasados: resumos.filter((r) => r.status_visao_geral === "atrasado").length,
    atencao: resumos.filter((r) => r.status_visao_geral === "atencao").length,
    ok: resumos.filter((r) => r.status_visao_geral === "ok").length,
    concluidos: resumos.filter((r) => r.status_visao_geral === "concluido").length,
  };

  return (
    <div className="space-y-6">
      <TabsSocialMedia active="d0-d30" />
      <header>
        <h1 className="text-2xl font-bold tracking-tight">D0 → D30</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhamento estruturado dos primeiros 30 dias do cliente, desde a entrada
          até o primeiro mês ativo.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {counts.total} clientes em onboarding · {counts.atrasados} atrasados ·{" "}
          {counts.atencao} atenção · {counts.ok} no prazo · {counts.concluidos} concluídos
        </p>
      </header>

      <D0D30Table
        resumos={resumos}
        canManage={canManage}
        elegiveis={elegiveis}
      />
    </div>
  );
}
