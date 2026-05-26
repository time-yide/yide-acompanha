import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getMonthlyChecklists, type ChecklistFilter } from "@/lib/painel/queries";
import { getClientIdsForActiveUnit } from "@/lib/units/filter-helpers";
import { PainelHeader } from "@/components/painel/PainelHeader";
import { TabsSocialMedia } from "@/components/social-media/TabsSocialMedia";
import { PainelTable } from "@/components/painel/PainelTable";
import { PainelCardsList } from "@/components/painel/PainelCardsList";
import { PainelKpis } from "@/components/painel/PainelKpis";
import { AreaFilterChips } from "@/components/painel/AreaFilter";
import { AssessorFilter } from "@/components/painel/AssessorFilter";
import { ClientSearchInput } from "@/components/painel/ClientSearchInput";
import { ViewToggle } from "@/components/painel/ViewToggle";
import { PACOTES_NO_PAINEL_MENSAL, type TipoPacote } from "@/lib/painel/pacote-matrix";
import { parseArea, matchesArea } from "@/lib/painel/area-filter";
import { getCurrentMonthYM } from "@/lib/datetime/timezone";
import { ensureMonthlyChecklistsImpl } from "@/lib/painel/ensure-checklists";

const ALLOWED_ROLES = ["adm", "socio", "coordenador", "assessor", "designer", "videomaker", "editor", "audiovisual_chefe"];
const PRIVILEGED_ROLES = ["adm", "socio", "coordenador"];

function currentMonthRef(): string {
  return getCurrentMonthYM();
}

function previousMonthRef(monthRef: string): string {
  const [y, m] = monthRef.split("-").map(Number);
  // m é 1-12; mês anterior pode virar o ano.
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, "0")}`;
}

function nextMonthRef(monthRef: string): string {
  const [y, m] = monthRef.split("-").map(Number);
  if (m === 12) return `${y + 1}-01`;
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

// Painel só ganhou estrutura de checklist a partir de mai/2026 — antes
// disso não tinha registros, então não vale a pena mostrar no dropdown.
const PAINEL_PRIMEIRO_MES = "2026-05";

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
  // Default: tabela (decisão Yasmin — densidade maior, mais útil pra
  // visualizar muitos clientes de uma vez). Cards continuam disponíveis
  // via ?view=cards no URL.
  const view: "cards" | "tabela" = params.view === "cards" ? "cards" : "tabela";
  const searchQuery = (params.q ?? "").trim().toLowerCase();

  const canFilterAssessor = PRIVILEGED_ROLES.includes(user.role);
  const assessorFiltro = canFilterAssessor && params.assessor ? params.assessor : null;

  // Multi-tenant: filtra clientes pela unidade ativa
  const unitClientIds = await getClientIdsForActiveUnit();

  const filter: ChecklistFilter = { unitClientIds };
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

  // Lista de meses: próximo mês primeiro (sempre disponível pra planejamento),
  // depois mês corrente, e os anteriores até PAINEL_PRIMEIRO_MES (mai/2026).
  // Anteriores a mai/26 não aparecem — não tinha estrutura de checklist.
  const mesesDisponiveis: string[] = [];
  const mesAtualRef = currentMonthRef();
  const proximoMes = nextMonthRef(mesAtualRef);
  mesesDisponiveis.push(proximoMes);
  let cursor = mesAtualRef;
  while (cursor >= PAINEL_PRIMEIRO_MES) {
    mesesDisponiveis.push(cursor);
    cursor = previousMonthRef(cursor);
  }

  // Cria proativamente os checklists do próximo mês (idempotente). Garante
  // que ao selecionar o próximo mês, o painel já tem dados. Custo: 1 SELECT
  // se já existem; 1 INSERT só na primeira vez do mês.
  // Roda só pra roles privilegiados (assessor/designer não disparam — eles
  // só consomem os checklists).
  if (PRIVILEGED_ROLES.includes(user.role)) {
    try {
      await ensureMonthlyChecklistsImpl(proximoMes);
    } catch {
      // Falha silenciosa: não bloqueia o render. Cron noturno (ou botão
      // "Atualizar painel") cobre se algo der errado aqui.
    }
  }

  return (
    <div className="space-y-5">
      <TabsSocialMedia active="painel" />
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
