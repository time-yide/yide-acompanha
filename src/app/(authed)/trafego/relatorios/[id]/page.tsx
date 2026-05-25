// src/app/(authed)/trafego/relatorios/[id]/page.tsx
import { redirect, notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { getRelatorio } from "@/lib/trafego/relatorios/queries";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { RelatorioDetalheClient } from "@/components/trafego/relatorios/RelatorioDetalheClient";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  if (!canAccess(user.role, "manage:trafego_relatorios")) redirect("/trafego");
  const { id } = await params;
  const rel = await getRelatorio(id);
  if (!rel) notFound();

  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;
  const { data: cliente } = await sbAny
    .from("clients")
    .select("nome")
    .eq("id", rel.cliente_id)
    .single();
  const clienteNome = (cliente as { nome: string } | null)?.nome ?? "Cliente";

  return <RelatorioDetalheClient relatorio={rel} clienteNome={clienteNome} />;
}
