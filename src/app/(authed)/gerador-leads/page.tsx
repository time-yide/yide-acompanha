import Link from "next/link";
import { notFound } from "next/navigation";
import { Radar } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import {
  listLeadsGerados,
  listPesquisas,
  getOrganizationId,
  type ListLeadsFilter,
} from "@/lib/gerador-leads/queries";
import type { StatusLead } from "@/lib/gerador-leads/tipos";
import { STATUS_LEAD_VALORES } from "@/lib/gerador-leads/tipos";
import { LeadsTable } from "@/components/gerador-leads/LeadsTable";
import { LeadsToolbar } from "@/components/gerador-leads/LeadsToolbar";
import { PesquisasRecentes } from "@/components/gerador-leads/PesquisasRecentes";

const ALLOWED_ROLES = ["adm", "socio", "comercial", "coordenador", "assessor"];
const ROLES_QUE_GERENCIAM = ["adm", "socio", "comercial", "coordenador", "assessor"];

export default async function GeradorLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    potencial?: string;
    ordem?: string;
    page?: string;
    comWhatsapp?: string;
    comInstagram?: string;
    comSite?: string;
  }>;
}) {
  const user = await requireAuth();
  if (!ALLOWED_ROLES.includes(user.role)) notFound();
  const params = await searchParams;

  const orgId = await getOrganizationId(user.id);
  if (!orgId) notFound();

  const status = params.status && (STATUS_LEAD_VALORES as readonly string[]).includes(params.status)
    ? (params.status as StatusLead)
    : "todos";

  const filter: ListLeadsFilter = {
    searchQuery: params.q,
    status,
    potencial: params.potencial || undefined,
    orderBy: (params.ordem as ListLeadsFilter["orderBy"]) ?? "recentes",
    page: params.page ? parseInt(params.page, 10) : 1,
    pageSize: 50,
    comWhatsapp: params.comWhatsapp === "1",
    comInstagram: params.comInstagram === "1",
    comSite: params.comSite === "1",
  };

  const [{ leads, total, page, totalPages }, pesquisas] = await Promise.all([
    listLeadsGerados(orgId, filter),
    listPesquisas(orgId, 5),
  ]);

  const canManage = ROLES_QUE_GERENCIAM.includes(user.role);

  // Stats agregadas
  const totalNovos = leads.filter((l) => l.status === "novo").length;
  const totalEmContato = leads.filter((l) => l.status === "em_contato" || l.status === "qualificado" || l.status === "reuniao_marcada").length;
  const totalClientes = leads.filter((l) => l.status === "cliente").length;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Radar className="h-6 w-6 text-primary" /> Gerador de Leads
          </h1>
          <p className="text-sm text-muted-foreground">
            Pesquisa empresas no Google Maps, qualifica e gerencia o pipeline.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <KpiTile label="Total" value={total} />
          <KpiTile label="Novos" value={totalNovos} accent="blue" />
          <KpiTile label="Em prospect" value={totalEmContato} accent="amber" />
          <KpiTile label="Viraram cliente" value={totalClientes} accent="emerald" />
        </div>
      </header>

      {/* Pesquisas recentes - auto-refresh quando tem rodando */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Pesquisas recentes
        </h2>
        <PesquisasRecentes pesquisas={pesquisas} />
      </section>

      {/* Toolbar (filtros + nova pesquisa + export) */}
      <LeadsToolbar total={total} leadsAtuais={leads} canManage={canManage} />

      {/* Tabela */}
      <LeadsTable leads={leads} canManage={canManage} />

      {/* Paginação */}
      {totalPages > 1 && (
        <Pagination current={page} total={totalPages} searchParams={params} />
      )}
    </div>
  );
}

function KpiTile({
  label, value, accent,
}: {
  label: string;
  value: number;
  accent?: "blue" | "amber" | "emerald";
}) {
  const accentClass =
    accent === "blue" ? "text-blue-600 dark:text-blue-400" :
    accent === "amber" ? "text-amber-600 dark:text-amber-400" :
    accent === "emerald" ? "text-emerald-600 dark:text-emerald-400" :
    "text-foreground";
  return (
    <div className="rounded-lg border bg-card px-4 py-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${accentClass}`}>{value}</p>
    </div>
  );
}

function Pagination({
  current, total, searchParams,
}: {
  current: number;
  total: number;
  searchParams: Record<string, string | undefined>;
}) {
  function pageUrl(p: number): string {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (v && k !== "page") sp.set(k, v);
    }
    sp.set("page", String(p));
    return `?${sp.toString()}`;
  }

  return (
    <div className="flex items-center justify-center gap-2 pt-2">
      <Link
        href={pageUrl(Math.max(1, current - 1))}
        aria-disabled={current <= 1}
        className={`inline-flex h-8 items-center rounded-md border bg-card px-3 text-xs hover:bg-muted ${current <= 1 ? "pointer-events-none opacity-40" : ""}`}
      >
        ← Anterior
      </Link>
      <span className="text-xs text-muted-foreground">
        Página {current} de {total}
      </span>
      <Link
        href={pageUrl(Math.min(total, current + 1))}
        aria-disabled={current >= total}
        className={`inline-flex h-8 items-center rounded-md border bg-card px-3 text-xs hover:bg-muted ${current >= total ? "pointer-events-none opacity-40" : ""}`}
      >
        Próxima →
      </Link>
    </div>
  );
}
