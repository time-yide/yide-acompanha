import { requireAuth } from "@/lib/auth/session";
import { DashboardSocioAdm } from "@/components/dashboard/DashboardSocioAdm";
import { DashboardCoord } from "@/components/dashboard/DashboardCoord";
import { DashboardAssessor } from "@/components/dashboard/DashboardAssessor";
import { DashboardComercial } from "@/components/dashboard/DashboardComercial";
import { StubGreeting } from "@/components/dashboard/StubGreeting";
import { ImpersonateBar } from "@/components/dashboard/ImpersonateBar";
import { listColaboradores, getColaboradorById } from "@/lib/colaboradores/queries";

interface TargetUser {
  id: string;
  role: string;
  nome: string;
}

function renderDashboardForRole(target: TargetUser) {
  if (target.role === "socio" || target.role === "adm") {
    return <DashboardSocioAdm nome={target.nome} />;
  }
  if (target.role === "coordenador") {
    return <DashboardCoord userId={target.id} nome={target.nome} />;
  }
  if (target.role === "assessor") {
    return <DashboardAssessor userId={target.id} nome={target.nome} />;
  }
  if (target.role === "comercial") {
    return <DashboardComercial userId={target.id} nome={target.nome} />;
  }
  return <StubGreeting nome={target.nome} />;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const params = await searchParams;
  const user = await requireAuth();

  const canImpersonate = user.role === "socio" || user.role === "adm";

  // Resolve target. Default = self. Sócio/adm com ?as= pode visualizar como outro colab.
  let target: TargetUser = { id: user.id, role: user.role, nome: user.nome };
  let isImpersonating = false;

  if (canImpersonate && params.as) {
    try {
      const profile = await getColaboradorById(params.as);
      const p = profile as { id: string; role: string; nome: string; ativo: boolean } | null;
      if (p?.id && p.ativo) {
        target = { id: p.id, role: p.role, nome: p.nome };
        isImpersonating = target.id !== user.id;
      }
    } catch {
      // uuid inválido ou não encontrado — silenciosamente cai no self
    }
  }

  // Lista de colaboradores pra dropdown — só fetch se o requester pode impersonate
  const colaboradores = canImpersonate
    ? (await listColaboradores({ ativo: true })).map((c) => ({
        id: c.id,
        nome: c.nome,
        role: c.role,
      }))
    : [];

  return (
    <div className="space-y-4">
      {canImpersonate && (
        <ImpersonateBar
          colaboradores={colaboradores}
          currentTargetId={isImpersonating ? target.id : null}
          isImpersonating={isImpersonating}
        />
      )}
      {renderDashboardForRole(target)}
    </div>
  );
}
