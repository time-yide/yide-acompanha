import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { listClientes, getClientesStats } from "@/lib/clientes/queries";
import { ClientesTable } from "@/components/clientes/ClientesTable";
import { ClientesAssignmentTable } from "@/components/clientes/ClientesAssignmentTable";
import { CarteiraResponsavelSelector } from "@/components/clientes/CarteiraResponsavelSelector";
import { listColaboradores } from "@/lib/colaboradores/queries";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ status?: string; imported?: string; responsavel?: string }> }) {
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

  // Sócio/adm em chooser mode (sem id selecionado) → não consulta, mostra prompt.
  const shouldQuery = !isMinhaCarteira || effectiveResponsavel !== undefined;
  const rows = shouldQuery
    ? await listClientes({ status, responsibleUserId: effectiveResponsavel })
    : [];

  const stats = await getClientesStats();

  // Listas só são necessárias para a versão editável da tabela.
  const [assessores, coordenadores] = canManage
    ? await Promise.all([
        listColaboradores({ ativo: true, role: "assessor" }),
        listColaboradores({ ativo: true, role: "coordenador" }),
      ]).then(([a, c]) => [
        a.map((r) => ({ id: r.id, nome: r.nome })),
        c.map((r) => ({ id: r.id, nome: r.nome })),
      ])
    : [[], []];

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
              : "—"}
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
