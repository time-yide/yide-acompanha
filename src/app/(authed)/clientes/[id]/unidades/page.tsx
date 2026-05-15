import { requireAuth } from "@/lib/auth/session";
import { listUnidadesByClient } from "@/lib/clientes/unidades/queries";
import { UnidadesManager } from "@/components/clientes/unidades/UnidadesManager";

const ROLES_PERMITIDOS_GERIR = ["adm", "socio", "coordenador", "assessor"];

export default async function UnidadesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireAuth();
  const unidades = await listUnidadesByClient(id);
  const canManage = ROLES_PERMITIDOS_GERIR.includes(user.role);

  return <UnidadesManager clientId={id} unidades={unidades} canManage={canManage} />;
}
