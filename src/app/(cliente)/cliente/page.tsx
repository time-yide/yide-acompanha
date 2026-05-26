import { requireClientPortalAuth } from "@/lib/auth/client-portal-session";
import { ClientPortalView } from "@/components/cliente-portal/ClientPortalView";

export default async function ClientePainelPage() {
  const user = await requireClientPortalAuth();
  return <ClientPortalView clientId={user.clientId} nomeContato={user.nomeContato} />;
}
