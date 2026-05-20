import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { listChannelsWithUnread } from "@/lib/escritorio/queries";
import { getEffectiveUnitId } from "@/lib/units/session";

export default async function EscritorioIndexPage() {
  const user = await requireAuth();
  // Multi-tenant: resolve unidade ativa pra filtrar canais role-based.
  const unitId = await getEffectiveUnitId();
  const channels = await listChannelsWithUnread(user.id, user.role, unitId);
  if (channels.length === 0) {
    return (
      <div className="mx-auto max-w-2xl py-12">
        <p className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          Você não tem acesso a nenhum canal do Escritório Virtual no momento.
        </p>
      </div>
    );
  }
  // Redireciona pro canal com mensagens não lidas, ou pro primeiro
  const target = channels.find((c) => c.unread_count > 0) ?? channels[0];
  redirect(`/escritorio/${target.kind}`);
}
