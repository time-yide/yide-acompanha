import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { listClientesComAcessoPortal } from "@/lib/painel-cliente/queries";
import { PainelClienteTable } from "@/components/painel-cliente/PainelClienteTable";

export default async function PainelClientePage() {
  const user = await requireAuth();
  if (!["adm", "socio"].includes(user.role)) notFound();

  const rows = await listClientesComAcessoPortal();
  const comAcesso = rows.filter((r) => r.portal !== null && r.portal.ativo).length;
  const semAcesso = rows.filter((r) => r.portal === null).length;
  const revogados = rows.filter((r) => r.portal !== null && !r.portal.ativo).length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Painel do cliente</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie acessos dos seus clientes ao portal externo onde eles acompanham
          contrato, tráfego, entregas e mais.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {comAcesso} com acesso · {semAcesso} sem acesso · {revogados} revogados
        </p>
      </header>

      <PainelClienteTable rows={rows} />
    </div>
  );
}
