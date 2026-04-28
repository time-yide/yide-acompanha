import { requireAuth } from "@/lib/auth/session";
import { DashboardSocioAdm } from "@/components/dashboard/DashboardSocioAdm";
import { StubGreeting } from "@/components/dashboard/StubGreeting";

export default async function DashboardPage() {
  const user = await requireAuth();

  if (user.role === "socio" || user.role === "adm") {
    return <DashboardSocioAdm nome={user.nome} />;
  }

  return <StubGreeting nome={user.nome} />;
}
