import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { getClienteById } from "@/lib/clientes/queries";
import { ClienteHeader } from "@/components/clientes/ClienteHeader";
import { ClienteSidebar } from "@/components/clientes/ClienteSidebar";

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
    ["adm", "socio"].includes(user.role) ||
    user.id === cliente.assessor_id ||
    user.id === cliente.coordenador_id;
  const canSeeHistorico = ["adm", "socio"].includes(user.role);

  return (
    <div className="space-y-5">
      <ClienteHeader cliente={cliente} canSeeMoney={canSeeMoney} />
      <div className="flex flex-col gap-5 md:flex-row">
        <ClienteSidebar clientId={id} canSeeHistorico={canSeeHistorico} />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
