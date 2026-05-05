import { requireAuth } from "@/lib/auth/session";
import { DashboardSocioAdm } from "@/components/dashboard/DashboardSocioAdm";
import { DashboardCoord } from "@/components/dashboard/DashboardCoord";
import { DashboardAssessor } from "@/components/dashboard/DashboardAssessor";
import { DashboardComercial } from "@/components/dashboard/DashboardComercial";
import { DashboardVideomaker } from "@/components/dashboard/DashboardVideomaker";
import { DashboardDesigner } from "@/components/dashboard/DashboardDesigner";
import { DashboardEditor } from "@/components/dashboard/DashboardEditor";
import { StubGreeting } from "@/components/dashboard/StubGreeting";
import type { Periodo } from "@/lib/dashboard/personal";

const PERIODOS_VALIDOS: ReadonlySet<Periodo> = new Set(["mes_atual", "mes_anterior", "dias_7", "total"]);

function parsePeriodo(raw: string | undefined): Periodo {
  if (raw && PERIODOS_VALIDOS.has(raw as Periodo)) return raw as Periodo;
  return "mes_atual";
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const params = await searchParams;
  const user = await requireAuth();
  const periodo = parsePeriodo(params.periodo);

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
  if (user.role === "videomaker") {
    return <DashboardVideomaker userId={user.id} nome={user.nome} />;
  }
  if (user.role === "designer") {
    return <DashboardDesigner userId={user.id} nome={user.nome} periodo={periodo} />;
  }
  if (user.role === "editor") {
    return <DashboardEditor userId={user.id} nome={user.nome} periodo={periodo} />;
  }
  return <StubGreeting nome={user.nome} />;
}
