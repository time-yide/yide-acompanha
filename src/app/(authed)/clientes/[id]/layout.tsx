import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { getClienteById } from "@/lib/clientes/queries";
import { ClienteHeader } from "@/components/clientes/ClienteHeader";
import { ClienteSidebar } from "@/components/clientes/ClienteSidebar";
import { getAjusteCliente } from "@/lib/clientes/ajustes";

export default async function ClienteFolderLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireAuth();

  let cliente;
  try { cliente = await getClienteById(id); } catch { notFound(); }

  const canSeeMoney =
    canAccess(user.role, "view:client_money_all") ||
    user.id === cliente.assessor_id ||
    user.id === cliente.coordenador_id;
  const canSeeHistorico = ["adm", "socio"].includes(user.role);
  const canDelete = ["adm", "socio"].includes(user.role);
  const canLancarAjuste = ["adm", "socio"].includes(user.role);

  // Ajuste do mês atual
  const now = new Date();
  const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const ajusteMes = canLancarAjuste ? await getAjusteCliente(id, mesAtual) : null;

  return (
    <div className="space-y-5">
      <ClienteHeader
        cliente={cliente}
        canSeeMoney={canSeeMoney}
        canDelete={canDelete}
        canLancarAjuste={canLancarAjuste}
        ajusteMes={ajusteMes}
      />
      <div className="flex flex-col gap-5 md:flex-row">
        <ClienteSidebar clientId={id} canSeeHistorico={canSeeHistorico} />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
