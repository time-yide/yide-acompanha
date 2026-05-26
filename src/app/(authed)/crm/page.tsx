import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Database, ExternalLink } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { listClientesComCrm } from "@/lib/crm/queries";
import { getEffectiveUnitId } from "@/lib/units/session";
import { CRM_BY_VALUE, CRM_DEFS, buildCrmOpenUrl } from "@/lib/crm/tipos";
import { Card } from "@/components/ui/card";
import { TabsTrafego } from "@/components/trafego/TabsTrafego";

const ALLOWED_ROLES = ["adm", "socio", "coordenador", "assessor", "comercial"];

export default async function CrmListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filtro?: string }>;
}) {
  const user = await requireAuth();
  if (!ALLOWED_ROLES.includes(user.role)) notFound();
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const filtroCrm = params.filtro ?? "todos";

  const filter: Parameters<typeof listClientesComCrm>[0] = { searchQuery: q, filtroCrm };
  if (user.role === "assessor") filter.assessorId = user.id;
  else if (user.role === "coordenador") filter.coordenadorId = user.id;
  filter.unitId = await getEffectiveUnitId();

  const clientes = await listClientesComCrm(filter);

  const totalConfigurados = clientes.filter((c) => c.crm_tipo && c.crm_tipo !== "nenhum").length;
  const totalYide = clientes.filter((c) => c.crm_tipo === "yide").length;

  return (
    <div className="space-y-5">
      <TabsTrafego active="crm" />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" /> CRM
          </h1>
          <p className="text-sm text-muted-foreground">
            Mapeia qual CRM cada cliente usa. Quando o CRM Yide estiver deployado,
            os links abrem direto a empresa do cliente lá em modo agência.
          </p>
        </div>
        <div className="flex gap-2">
          <KpiTile label="Clientes" value={clientes.length} />
          <KpiTile label="Com CRM cadastrado" value={totalConfigurados} accent="emerald" />
          <KpiTile label="Usando CRM Yide" value={totalYide} accent="primary" />
        </div>
      </header>

      <form method="get" className="flex flex-wrap gap-2">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Pesquisar cliente..."
          className="h-9 flex-1 rounded-md border bg-card px-3 text-sm md:max-w-xs"
        />
        <select
          name="filtro"
          defaultValue={filtroCrm}
          className="h-9 rounded-md border bg-card px-2 text-sm"
        >
          <option value="todos">Todos</option>
          <option value="configurado">Com CRM</option>
          <option value="nao_configurado">Sem CRM</option>
          <option disabled>──────</option>
          {CRM_DEFS.filter((c) => c.value !== "nenhum").map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <button
          type="submit"
          className="h-9 rounded-md border bg-card px-3 text-sm hover:bg-muted"
        >
          Aplicar
        </button>
      </form>

      {clientes.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {q
            ? `Nenhum cliente encontrado pra "${q}".`
            : "Nenhum cliente ativo nesse filtro."}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {clientes.map((c) => {
            const def = c.crm_tipo ? CRM_BY_VALUE[c.crm_tipo] : null;
            const openUrl = buildCrmOpenUrl(c.crm_tipo, c.crm_url, c.crm_identifier);
            return (
              <Link
                key={c.id}
                href={`/crm/${c.id}`}
                className="group block rounded-lg border bg-card p-4 transition-colors hover:border-primary hover:bg-muted/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold leading-tight min-w-0 truncate">{c.nome}</h3>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {def ? (
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${def.color}`}>
                      {def.isYide ? "⭐ " : ""}{def.label}
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                      Sem CRM cadastrado
                    </span>
                  )}
                </div>
                {openUrl && (
                  <a
                    href={openUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="mt-2 inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> Abrir CRM
                  </a>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function KpiTile({
  label, value, accent,
}: {
  label: string;
  value: number;
  accent?: "emerald" | "primary";
}) {
  const accentClass =
    accent === "emerald" ? "text-emerald-600 dark:text-emerald-400" :
    accent === "primary" ? "text-primary" :
    "text-foreground";
  return (
    <div className="rounded-lg border bg-card px-4 py-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${accentClass}`}>{value}</p>
    </div>
  );
}
