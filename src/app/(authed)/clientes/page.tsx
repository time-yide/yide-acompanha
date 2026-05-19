import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { listClientes, getClientesStats } from "@/lib/clientes/queries";
import { getEffectiveUnitId } from "@/lib/units/session";
import { ClientesTable } from "@/components/clientes/ClientesTable";
import { ClientesAssignmentTable } from "@/components/clientes/ClientesAssignmentTable";
import { CarteiraResponsavelSelector } from "@/components/clientes/CarteiraResponsavelSelector";
import { listColaboradores } from "@/lib/colaboradores/queries";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { APP_TIMEZONE } from "@/lib/datetime/timezone";

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ status?: string; imported?: string; responsavel?: string; modalidade?: string; churn_mes?: string }> }) {
  const params = await searchParams;
  const user = await requireAuth();
  const canManage = ["adm", "socio"].includes(user.role);
  const canSeeMoney = canAccess(user.role, "view:client_money_all");
  const canSeeCarteira = ["assessor", "coordenador", "socio", "adm"].includes(user.role);
  const canPickAnyResponsavel = ["socio", "adm"].includes(user.role);

  // "Minha carteira" está ativo quando o param `responsavel` está presente
  // (com qualquer valor, inclusive vazio — vazio = chooser mode pra sócio/adm).
  const responsavelParam = params.responsavel;
  const isMinhaCarteira = responsavelParam !== undefined;

  // Assessor/coord são travados no próprio id; sócio/adm pegam do param.
  const effectiveResponsavel: string | undefined = isMinhaCarteira
    ? canPickAnyResponsavel
      ? (responsavelParam || undefined)
      : user.id
    : undefined;

  // Em "Minha carteira" forçamos status=ativo (decisão de produto: carteira = ativos).
  const status: "ativo" | "churn" | undefined = isMinhaCarteira
    ? "ativo"
    : ((params.status as "ativo" | "churn" | undefined) ?? undefined);

  // Drill-down filters (vindos dos KPIs do dashboard).
  const modalidade: "mensal" | "pontual" | undefined =
    params.modalidade === "mensal" || params.modalidade === "pontual"
      ? params.modalidade
      : undefined;
  // churn_mes vem como YYYY-MM. Valida formato pra não passar lixo pro Supabase.
  const churnMonth: string | undefined =
    params.churn_mes && /^\d{4}-\d{2}$/.test(params.churn_mes) ? params.churn_mes : undefined;

  // Sócio/adm em chooser mode (sem id selecionado) → não consulta, mostra prompt.
  const shouldQuery = !isMinhaCarteira || effectiveResponsavel !== undefined;

  // Multi-tenant Fase 2: filtra por unidade ativa. Master pode estar vendo
  // Salvador (cookie); non-master sempre sua home unit.
  const unitId = await getEffectiveUnitId();

  // Roda as 4 queries em paralelo: rows, stats, e (se canManage) as duas listas
  // de colaboradores. Ganho: ~3x menos round-trips na página /clientes (uma
  // das mais acessadas do app).
  const [rows, stats, assessoresRaw, coordenadoresRaw] = await Promise.all([
    shouldQuery
      ? listClientes({
          status,
          responsibleUserId: effectiveResponsavel,
          modalidade,
          churnMonth,
          unitId,
        })
      : Promise.resolve([]),
    getClientesStats(unitId),
    canManage ? listColaboradores({ ativo: true, role: "assessor" }) : Promise.resolve([]),
    // "Coordenador" no UI cobre adm/socio/coordenador — alguns profiles
    // antigos podem ter ficado como adm em vez de socio.
    canManage
      ? listColaboradores({ ativo: true, roles: ["adm", "socio", "coordenador"] })
      : Promise.resolve([]),
  ]);
  const assessores = assessoresRaw.map((r) => ({ id: r.id, nome: r.nome }));
  const coordenadores = coordenadoresRaw.map((r) => ({ id: r.id, nome: r.nome }));

  // Lista do seletor de responsáveis (só sócio/adm precisa).
  const responsaveis = canPickAnyResponsavel
    ? [...assessores, ...coordenadores]
        .filter((r, i, arr) => arr.findIndex((x) => x.id === r.id) === i)
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    : [];

  const activeTab: "ativos" | "churn" | "todos" | "carteira" = isMinhaCarteira
    ? "carteira"
    : status === "ativo"
      ? "ativos"
      : status === "churn"
        ? "churn"
        : "todos";
  const tabClass = (active: boolean) =>
    active ? "font-semibold text-primary" : "text-muted-foreground";

  // Sócio/adm landa em chooser mode (responsavel vazio); assessor/coord landa no próprio id.
  const carteiraHref = canPickAnyResponsavel
    ? "/clientes?responsavel="
    : `/clientes?responsavel=${user.id}`;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            {stats.total_ativos} ativos · {stats.total_churn} em churn · carteira{" "}
            {canSeeMoney
              ? stats.carteira_total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
              : ""}
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Link href="/clientes/importar" className={buttonVariants({ variant: "outline" })}>
              Importar em lote
            </Link>
            <Link href="/clientes/novo" className={buttonVariants()}>
              <Plus className="mr-2 h-4 w-4" />Novo cliente
            </Link>
          </div>
        )}
      </header>

      {params.imported && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          ✓ {params.imported} cliente(s) importado(s) com sucesso.
        </div>
      )}

      {(modalidade || churnMonth) && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-xs">
          <span className="text-muted-foreground">Filtrado por:</span>
          {modalidade && (
            <span className="rounded-full bg-primary/15 px-2 py-0.5 font-medium text-primary">
              Modalidade: {modalidade === "pontual" ? "pontual" : "mensal"}
            </span>
          )}
          {churnMonth && (
            <span className="rounded-full bg-primary/15 px-2 py-0.5 font-medium text-primary">
              Churn em {(() => {
                const [yyyy, mm] = churnMonth.split("-");
                return new Date(`${yyyy}-${mm}-15T12:00:00`).toLocaleDateString("pt-BR", {
                  timeZone: APP_TIMEZONE,
                  month: "long",
                  year: "numeric",
                });
              })()}
            </span>
          )}
          <Link
            href="/clientes"
            className="ml-auto text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Limpar filtros
          </Link>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link href="/clientes?status=ativo" className={tabClass(activeTab === "ativos")}>Ativos</Link>
        <span className="text-muted-foreground">·</span>
        <Link href="/clientes?status=churn" className={tabClass(activeTab === "churn")}>Churn</Link>
        <span className="text-muted-foreground">·</span>
        <Link href="/clientes" className={tabClass(activeTab === "todos")}>Todos</Link>
        {canSeeCarteira && (
          <>
            <span className="text-muted-foreground">·</span>
            <Link href={carteiraHref} className={tabClass(activeTab === "carteira")}>Minha carteira</Link>
          </>
        )}
        {isMinhaCarteira && canPickAnyResponsavel && (
          <div className="ml-auto">
            <CarteiraResponsavelSelector
              responsaveis={responsaveis}
              current={effectiveResponsavel ?? ""}
            />
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-card">
        {isMinhaCarteira && canPickAnyResponsavel && !effectiveResponsavel ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">
            Selecione um colaborador acima para ver a carteira dele.
          </p>
        ) : isMinhaCarteira && rows.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">
            Nenhum cliente ativo nessa carteira.
          </p>
        ) : canManage ? (
          <ClientesAssignmentTable
            rows={rows}
            canSeeMoney={canSeeMoney}
            assessores={assessores}
            coordenadores={coordenadores}
          />
        ) : (
          <ClientesTable rows={rows} canSeeMoney={canSeeMoney} />
        )}
      </div>
    </div>
  );
}
