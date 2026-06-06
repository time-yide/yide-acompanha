// src/app/(authed)/design/[clientId]/studio/[arteId]/page.tsx
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { isDesignRole } from "@/lib/design/roles";
import { getManualMarca } from "@/lib/design/queries";
import { getComposicaoAction } from "@/lib/design/studio-actions";
import { StudioShell } from "@/components/design/studio/StudioShell";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export default async function StudioEditarPage({
  params,
}: {
  params: Promise<{ clientId: string; arteId: string }>;
}) {
  const user = await requireAuth();
  if (!isDesignRole(user.role)) notFound();

  const { clientId, arteId } = await params;
  const [manual, arte] = await Promise.all([
    getManualMarca(clientId),
    getComposicaoAction(clientId, arteId),
  ]);

  if ("error" in arte) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cli } = await (createServiceRoleClient() as any)
    .from("clients")
    .select("nome")
    .eq("id", clientId)
    .single();
  if (!cli) notFound();

  return (
    <StudioShell
      clientId={clientId}
      nomeCliente={cli.nome}
      manualInicial={manual}
      arteInicial={{
        id: arteId,
        titulo: arte.titulo,
        composicao: arte.composicao,
      }}
    />
  );
}
