import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getMonthlyChecklists, type ChecklistFilter } from "@/lib/painel/queries";
import { PainelHeader } from "@/components/painel/PainelHeader";
import { PainelTable } from "@/components/painel/PainelTable";
import { PainelCardsList } from "@/components/painel/PainelCardsList";
import { PainelKpis } from "@/components/painel/PainelKpis";
import { AreaFilterChips } from "@/components/painel/AreaFilter";
import { AssessorFilter } from "@/components/painel/AssessorFilter";
import { ClientSearchInput } from "@/components/painel/ClientSearchInput";
import { ViewToggle } from "@/components/painel/ViewToggle";
import { PACOTES_NO_PAINEL_MENSAL, type TipoPacote } from "@/lib/painel/pacote-matrix";
import { parseArea, matchesArea } from "@/lib/painel/area-filter";

const ALLOWED_ROLES = ["adm", "socio", "coordenador", "assessor", "designer", "videomaker", "editor", "audiovisual_chefe"];
const PRIVILEGED_ROLES = ["adm", "socio", "coordenador"];

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
  searchParams: Promise<{ mes?: string; tipo?: string; area?: string; assessor?: string; view?: string; q?: string }>;
}) {
  const user = await requireAuth();
  if (!ALLOWED_ROLES.includes(user.role)) notFound();
  const params = await searchParams;

  const mesAtual = params.mes && /^\d{4}-\d{2}$/.test(params.mes) ? params.mes : currentMonthRef();
  const tipoFiltro: TipoPacote | "todos" =
    params.tipo && (PACOTES_NO_PAINEL_MENSAL as readonly string[]).includes(params.tipo)
      ? (params.tipo as TipoPacote)
      : "todos";
  const areaFiltro = parseArea(params.area);
  const view: "cards" | "tabela" = params.view === "tabela" ? "tabela" : "cards";
  const searchQuery = (params.q ?? "").trim().toLowerCase();

  const canFilterAssessor = PRIVILEGED_ROLES.includes(user.role);
  const assessorFiltro = canFilterAssessor && params.assessor ? params.assessor : null;

  const filter: ChecklistFilter = {};
  if (user.role === "assessor") filter.assessorId = user.id;
  else if (user.role === "coordenador") {
    filter.coordenadorId = user.id;
    if (assessorFiltro) filter.assessorId = assessorFiltro;
  } else if (user.role === "designer") filter.designerId = user.id;
  else if (user.role === "videomaker") filter.audiovisualUserId = user.id;
  else if (user.role === "editor") filter.editorId = user.id;
  else if (PRIVILEGED_ROLES.includes(user.role) && assessorFiltro) {
    filter.assessorId = assessorFiltro;
  }
  // audiovisual_chefe sem filtro: vê todos.

  // Paraleliza checklists + assessoresOptions (não dependem entre si)
  const supabase = await createClient();
  const assessoresPromise = canFilterAssessor
    ? supabase
        .from("profiles")
        .select("id, nome")
        .eq("ativo", true)
        .eq("role", "assessor")
        .order("nome")
        .then((r) => ((r.data ?? []) as Array<{ id: string; nome: string }>))
    : Promise.resolve([] as Array<{ id: string; nome: string }>);

  const [allChecklists, assessoresOptions] = await Promise.all([
    getMonthlyChecklists(mesAtual, filter),
    assessoresPromise,
  ]);

  const checklists = allChecklists
    .filter((c) => tipoFiltro === "todos" || c.client_tipo_pacote === tipoFiltro)
    .filter((c) => matchesArea(c.client_tipo_pacote as TipoPacote, areaFiltro))
    .filter((c) => searchQuery === "" || c.client_nome.toLowerCase().includes(searchQuery));

  const mesesDisponiveis: string[] = [];
  let cursor = currentMonthRef();
  for (let i = 0; i < 12; i++) {
    mesesDisponiveis.push(cursor);
    cursor = previousMonthRef(cursor);
  }

  return (
    <div className="space-y-5">
      <PainelHeader
        mesAtual={mesAtual}
        mesesDisponiveis={mesesDisponiveis}
        tipoFiltro={tipoFiltro}
        canAtualizar={PRIVILEGED_ROLES.includes(user.role)}
      />

      <PainelKpis checklists={checklists} />

      <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border bg-card p-3">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Área</p>
          <AreaFilterChips current={areaFiltro} />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <ClientSearchInput current={params.q ?? ""} />
          {canFilterAssessor && (
            <AssessorFilter current={assessorFiltro} options={assessoresOptions} />
          )}
          <ViewToggle current={view} />
        </div>
      </div>

      {view === "cards" ? (
        <PainelCardsList checklists={checklists} userRole={user.role} userId={user.id} />
      ) : (
        <PainelTable checklists={checklists} userRole={user.role} userId={user.id} />
      )}
    </div>
  );
}
