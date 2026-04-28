import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { getMonthlyChecklists, type ChecklistFilter } from "@/lib/painel/queries";
import { PainelHeader } from "@/components/painel/PainelHeader";
import { PainelTable } from "@/components/painel/PainelTable";

const ALLOWED_ROLES = ["adm", "socio", "coordenador", "assessor", "designer", "videomaker", "editor", "audiovisual_chefe"];

function currentMonthRef(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function previousMonthRef(monthRef: string): string {
  const [y, m] = monthRef.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function PainelPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const user = await requireAuth();
  if (!ALLOWED_ROLES.includes(user.role)) notFound();
  const params = await searchParams;

  const mesAtual = params.mes && /^\d{4}-\d{2}$/.test(params.mes) ? params.mes : currentMonthRef();

  const filter: ChecklistFilter = {};
  if (user.role === "assessor") filter.assessorId = user.id;
  else if (user.role === "coordenador") filter.coordenadorId = user.id;
  else if (user.role === "designer") filter.designerId = user.id;
  else if (user.role === "videomaker") filter.videomakerId = user.id;
  else if (user.role === "editor") filter.editorId = user.id;

  const checklists = await getMonthlyChecklists(mesAtual, filter);

  const mesesDisponiveis: string[] = [];
  let cursor = currentMonthRef();
  for (let i = 0; i < 12; i++) {
    mesesDisponiveis.push(cursor);
    cursor = previousMonthRef(cursor);
  }

  return (
    <div className="space-y-5">
      <PainelHeader mesAtual={mesAtual} mesesDisponiveis={mesesDisponiveis} />
      <PainelTable
        checklists={checklists}
        userRole={user.role}
        userId={user.id}
      />
    </div>
  );
}
