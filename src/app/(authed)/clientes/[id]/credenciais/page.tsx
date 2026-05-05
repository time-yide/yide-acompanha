import { notFound, redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import {
  canAccessClientCredentials,
  listCredentialsByClient,
} from "@/lib/credenciais/queries";
import { CredentialList } from "@/components/credenciais/CredentialList";

export default async function ClienteCredenciaisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireAuth();

  const allowed = await canAccessClientCredentials({
    userId: user.id,
    userRole: user.role,
    clientId: id,
  });
  if (!allowed) {
    // Sem permissão pra ver: redireciona pra home (ou poderia ser 403)
    redirect("/?error=forbidden");
  }

  let credentials;
  try {
    credentials = await listCredentialsByClient(id);
  } catch {
    notFound();
  }

  return (
    <div className="space-y-4">
      <CredentialList clientId={id} credentials={credentials} />
    </div>
  );
}
