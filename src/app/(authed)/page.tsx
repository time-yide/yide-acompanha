import { requireAuth } from "@/lib/auth/session";
import { DashboardSocioAdm } from "@/components/dashboard/DashboardSocioAdm";
import { DashboardCoord } from "@/components/dashboard/DashboardCoord";
import { DashboardAssessor } from "@/components/dashboard/DashboardAssessor";
import { DashboardComercial } from "@/components/dashboard/DashboardComercial";
import { StubGreeting } from "@/components/dashboard/StubGreeting";

export default async function DashboardPage() {
  const user = await requireAuth();

  if (user.role === "socio" || user.role === "adm") {
    return <DashboardSocioAdm nome={user.nome} />;
  }
  if (user.role === "coordenador") {
    return <DashboardCoord userId={user.id} nome={user.nome} />;
  }
  if (user.role === "assessor") {
    return <DashboardAssessor userId={user.id} nome={user.nome} />;
  }
  if (user.role === "comercial") {
    return <DashboardComercial userId={user.id} nome={user.nome} />;
  }
  return <StubGreeting nome={user.nome} />;
}
