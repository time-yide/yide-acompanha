import { requireAuth } from "@/lib/auth/session";
import { DashboardSocioAdm } from "@/components/dashboard/DashboardSocioAdm";
import { DashboardAdm } from "@/components/dashboard/DashboardAdm";

// Força a página a ser sempre dynamic — sem cache de fetch nem ISR.
// Mudanças em clientes (tipo_pacote, etc) refletem no dashboard na hora.
export const dynamic = "force-dynamic";
import { DashboardCoord } from "@/components/dashboard/DashboardCoord";
import { DashboardAssessor } from "@/components/dashboard/DashboardAssessor";
import { DashboardComercial } from "@/components/dashboard/DashboardComercial";
import { DashboardVideomaker } from "@/components/dashboard/DashboardVideomaker";
import { DashboardDesigner } from "@/components/dashboard/DashboardDesigner";
import { DashboardEditor } from "@/components/dashboard/DashboardEditor";
import { DashboardAudiovisualChefe } from "@/components/dashboard/DashboardAudiovisualChefe";
import { StubGreeting } from "@/components/dashboard/StubGreeting";
import { ImpersonateBar } from "@/components/dashboard/ImpersonateBar";
import { UnitDashboardBanner } from "@/components/units/UnitDashboardBanner";
import { listColaboradores, getColaboradorById } from "@/lib/colaboradores/queries";
import { getUnitContext } from "@/lib/units/session";
import type { Periodo } from "@/lib/dashboard/personal";
import { parseMes, mesesRecentes } from "@/lib/dashboard/date-utils";
import { getCurrentMonthYM } from "@/lib/datetime/timezone";

interface TargetUser {
  id: string;
  role: string;
  nome: string;
  especialidade: string | null;
}

const PERIODOS_VALIDOS: ReadonlySet<Periodo> = new Set(["mes_atual", "mes_anterior", "dias_7", "total"]);

function parsePeriodo(raw: string | undefined): Periodo {
  if (raw && PERIODOS_VALIDOS.has(raw as Periodo)) return raw as Periodo;
  return "mes_atual";
}

function renderDashboardForRole(
  target: TargetUser,
  periodo: Periodo,
  mesCtx: { mes: string; mesAtual: string; meses: string[] },
) {
  if (target.role === "socio") {
    return <DashboardSocioAdm userId={target.id} nome={target.nome} {...mesCtx} />;
  }
  if (target.role === "adm") {
    return <DashboardAdm userId={target.id} nome={target.nome} {...mesCtx} />;
  }
  if (target.role === "coordenador") {
    return <DashboardCoord userId={target.id} nome={target.nome} {...mesCtx} />;
  }
  if (target.role === "assessor") {
    return (
      <DashboardAssessor
        userId={target.id}
        nome={target.nome}
        especialidade={target.especialidade}
        {...mesCtx}
      />
    );
  }
  if (target.role === "comercial") {
    return <DashboardComercial userId={target.id} nome={target.nome} {...mesCtx} />;
  }
  if (target.role === "videomaker") {
    return <DashboardVideomaker userId={target.id} nome={target.nome} />;
  }
  if (target.role === "designer") {
    return <DashboardDesigner userId={target.id} nome={target.nome} periodo={periodo} />;
  }
  if (target.role === "editor") {
    return <DashboardEditor userId={target.id} nome={target.nome} periodo={periodo} />;
  }
  if (target.role === "audiovisual_chefe") {
    return <DashboardAudiovisualChefe userId={target.id} nome={target.nome} periodo={periodo} />;
  }
  return <StubGreeting nome={target.nome} />;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string; periodo?: string; mes?: string }>;
}) {
  const params = await searchParams;
  const user = await requireAuth();
  const periodo = parsePeriodo(params.periodo);
  const mesAtual = getCurrentMonthYM(new Date());
  // Âncora no meio do mês atual em UTC: mesesRecentes/parseMes operam em UTC,
  // mas mesAtual vem do fuso da app (Cuiabá). Sem isso, na virada de mês o mês
  // corrente seria tratado como "histórico" por algumas horas.
  const refMes = new Date(`${mesAtual}-15T12:00:00Z`);
  const mes = parseMes(params.mes, refMes);
  const meses = mesesRecentes(12, refMes);

  const canImpersonate = user.role === "socio" || user.role === "adm";

  // Resolve target. Default = self. Sócio/adm com ?as= pode visualizar como outro colab.
  let target: TargetUser = { id: user.id, role: user.role, nome: user.nome, especialidade: null };
  let isImpersonating = false;

  if (canImpersonate && params.as) {
    try {
      const profile = await getColaboradorById(params.as);
      const p = profile as { id: string; role: string; nome: string; ativo: boolean; especialidade?: string | null } | null;
      if (p?.id && p.ativo) {
        target = { id: p.id, role: p.role, nome: p.nome, especialidade: p.especialidade ?? null };
        isImpersonating = target.id !== user.id;
      }
    } catch {
      // uuid inválido ou não encontrado - silenciosamente cai no self
    }
  }

  // Self assessor: busca a especialidade pro selo do próprio dashboard.
  // (Só assessor mostra o selo no header; evita query extra pros demais.)
  if (!isImpersonating && target.role === "assessor") {
    try {
      const self = (await getColaboradorById(user.id)) as { especialidade?: string | null } | null;
      target = { ...target, especialidade: self?.especialidade ?? null };
    } catch {
      // sem especialidade — segue como assessor comum
    }
  }

  // Lista de colaboradores pra dropdown - só fetch se o requester pode impersonate
  const [colaboradores, unitContext] = await Promise.all([
    canImpersonate
      ? listColaboradores({ ativo: true }).then((rows) =>
          rows.map((c) => ({ id: c.id, nome: c.nome, role: c.role, especialidade: c.especialidade })),
        )
      : Promise.resolve([] as Array<{ id: string; nome: string; role: string; especialidade: string | null }>),
    getUnitContext().catch(() => null),
  ]);

  return (
    <div className="space-y-4">
      {/* Banner gigante de unidade - só renderiza pra master (adm/sócio) que
          tenha mais de 1 unidade acessível. Permite trocar rápido sem ir no
          TopBar discreto. */}
      {unitContext?.isMaster && unitContext.accessibleUnits.length > 1 && (
        <UnitDashboardBanner
          activeUnit={unitContext.activeUnit}
          accessibleUnits={unitContext.accessibleUnits}
        />
      )}
      {canImpersonate && (
        <ImpersonateBar
          colaboradores={colaboradores}
          currentTargetId={isImpersonating ? target.id : null}
          isImpersonating={isImpersonating}
        />
      )}
      {renderDashboardForRole(target, periodo, { mes, mesAtual, meses })}
    </div>
  );
}
