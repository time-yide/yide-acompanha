// src/app/(authed)/painel-cliente/preview/[clientId]/page.tsx
//
// "Ver como o cliente está vendo" — renderiza o portal /cliente exatamente
// como o cliente vê, mas sem precisar do login dele. Usado pelos
// colaboradores internos (adm/sócio/coord/assessor) pra conferir o que o
// cliente está vendo.

import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { ClientPortalView } from "@/components/cliente-portal/ClientPortalView";

const ALLOWED_ROLES = ["adm", "socio", "coordenador", "assessor", "audiovisual_chefe"];

export default async function PainelClientePreviewPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const user = await requireAuth();
  if (!ALLOWED_ROLES.includes(user.role)) notFound();

  const { clientId } = await params;

  // Valida que o cliente existe + está ativo. Se não, 404 limpo.
  const sb = createServiceRoleClient();
  const { data: client } = await sb
    .from("clients")
    .select("id, status")
    .eq("id", clientId)
    .maybeSingle();
  if (!client || client.status !== "ativo") notFound();

  return (
    <ClientPortalView
      clientId={clientId}
      nomeContato={user.nome}
      previewMode
    />
  );
}
