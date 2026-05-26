import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { listClientesComAcessoPortal } from "@/lib/painel-cliente/queries";
import { getClientIdsForActiveUnit } from "@/lib/units/filter-helpers";
import { PainelClienteTable } from "@/components/painel-cliente/PainelClienteTable";
import { CopyLinkButton } from "@/components/painel-cliente/CopyLinkButton";
import { TabsPainelCliente } from "@/components/painel-cliente/TabsPainelCliente";
import { env } from "@/lib/env";

const ALLOWED_ROLES = ["adm", "socio", "coordenador", "assessor", "audiovisual_chefe"];

export default async function PainelClientePage() {
  const user = await requireAuth();
  if (!ALLOWED_ROLES.includes(user.role)) notFound();

  // Multi-tenant: filtra clientes pela unidade ativa
  const unitClientIds = await getClientIdsForActiveUnit();
  const rows = await listClientesComAcessoPortal(unitClientIds);

  // Cada métrica conta CLIENTES (não acessos):
  //  - comAcesso: cliente tem ≥1 acesso ativo
  //  - semAcesso: cliente nunca recebeu acesso
  //  - revogados: cliente já teve acesso mas nenhum está ativo
  const comAcesso = rows.filter((r) => r.portals.some((p) => p.ativo)).length;
  const semAcesso = rows.filter((r) => r.portals.length === 0).length;
  const revogados = rows.filter(
    (r) => r.portals.length > 0 && !r.portals.some((p) => p.ativo),
  ).length;

  // URL única do portal - todo cliente entra pelo mesmo /cliente/login
  const loginUrl = `${env.NEXT_PUBLIC_APP_URL}/cliente/login`;

  return (
    <div className="space-y-6">
      <TabsPainelCliente active="painel" />
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Painel do cliente</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie acessos dos seus clientes ao portal externo onde eles acompanham
          contrato, tráfego, entregas e mais. Cada cliente pode ter até 5 acessos
          ativos, útil pra empresas com sócios.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {comAcesso} com acesso · {semAcesso} sem acesso · {revogados} revogados
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
        <div className="space-y-0.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary/80">
            Link de acesso do portal
          </p>
          <p className="break-all font-mono text-xs text-foreground/80">{loginUrl}</p>
        </div>
        <CopyLinkButton loginUrl={loginUrl} label="Copiar link" />
      </div>

      <PainelClienteTable rows={rows} loginUrl={loginUrl} />
    </div>
  );
}
