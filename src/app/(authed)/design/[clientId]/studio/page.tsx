// src/app/(authed)/design/[clientId]/studio/page.tsx
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { isDesignRole } from "@/lib/design/roles";
import { getManualMarca } from "@/lib/design/queries";
import { StudioShell } from "@/components/design/studio/StudioShell";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export default async function StudioNovoPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const user = await requireAuth();
  if (!isDesignRole(user.role)) notFound();

  const { clientId } = await params;
  const manual = await getManualMarca(clientId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cli } = await (createServiceRoleClient() as any)
    .from("clients")
    .select("nome")
    .eq("id", clientId)
    .single();
  if (!cli) notFound();

  return (
    <StudioShell clientId={clientId} nomeCliente={cli.nome} manualInicial={manual} />
  );
}
