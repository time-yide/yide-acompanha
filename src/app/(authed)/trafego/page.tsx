import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, FileText, Megaphone } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { listClientesTrafego } from "@/lib/trafego/queries";
import { getEffectiveUnitId } from "@/lib/units/session";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TabsTrafego } from "@/components/trafego/TabsTrafego";

const ALLOWED_ROLES = ["adm", "socio", "coordenador", "assessor", "comercial"];
const PRIVILEGED_ROLES = ["adm", "socio", "coordenador"];

const PACOTE_LABELS: Record<string, string> = {
  trafego_estrategia: "Tráfego + Estratégia",
  trafego: "Tráfego",
  yide_360: "Yide 360°",
};

export default async function TrafegoListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireAuth();
  if (!ALLOWED_ROLES.includes(user.role)) notFound();
  const params = await searchParams;
  const q = (params.q ?? "").trim();

  const filter: Parameters<typeof listClientesTrafego>[0] = { searchQuery: q };
  if (user.role === "assessor") filter.assessorId = user.id;
  else if (user.role === "coordenador") filter.coordenadorId = user.id;
  // adm/socio/comercial: vê tudo (mas só da unidade ativa)
  filter.unitId = await getEffectiveUnitId();

  const clientes = await listClientesTrafego(filter);

  const totalAtivas = clientes.reduce((s, c) => s + c.campanhas_ativas, 0);
  const totalCampanhas = clientes.reduce((s, c) => s + c.total_campanhas, 0);

  return (
    <div className="space-y-5">
      <TabsTrafego active="trafego" />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-primary" /> Tráfego
          </h1>
          <p className="text-sm text-muted-foreground">
            Campanhas ativas por cliente. Clica em um cliente pra criar/editar campanhas e ver métricas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canAccess(user.role, "manage:trafego_relatorios") && (
            <Link
              href="/trafego/relatorios"
              className="inline-flex h-9 items-center gap-2 rounded-md border bg-card px-3 text-sm font-medium hover:bg-muted"
            >
              <FileText className="h-4 w-4" />
              Relatórios
            </Link>
          )}
          <KpiTile label="Clientes" value={clientes.length} />
          <KpiTile label="Campanhas ativas" value={totalAtivas} accent="emerald" />
          <KpiTile label="Total de campanhas" value={totalCampanhas} />
        </div>
      </header>

      <form method="get" className="flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Pesquisar cliente..."
          className="h-9 flex-1 rounded-md border bg-card px-3 text-sm md:max-w-md"
        />
        <button
          type="submit"
          className="h-9 rounded-md border bg-card px-3 text-sm hover:bg-muted"
        >
          Buscar
        </button>
      </form>

      {clientes.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {q
            ? `Nenhum cliente encontrado pra "${q}".`
            : "Nenhum cliente com pacote de tráfego ativo."}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {clientes.map((c) => (
            <Link
              key={c.id}
              href={`/trafego/${c.id}`}
              className="group block rounded-lg border bg-card p-4 transition-colors hover:border-primary hover:bg-muted/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <h3 className="font-semibold leading-tight">{c.nome}</h3>
                  <Badge variant="secondary" className="text-[10px]">
                    {PACOTE_LABELS[c.tipo_pacote] ?? c.tipo_pacote}
                  </Badge>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </div>
              <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {c.campanhas_ativas} ativa{c.campanhas_ativas === 1 ? "" : "s"}
                </span>
                <span className="text-muted-foreground/60">·</span>
                <span>{c.total_campanhas} no total</span>
              </div>
              {(c.meta_ad_account_id || c.google_ads_customer_id) && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {c.meta_ad_account_id && (
                    <span className="inline-flex items-center rounded-full border border-blue-500/40 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300">
                      Meta conectado
                    </span>
                  )}
                  {c.google_ads_customer_id && (
                    <span className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                      Google conectado
                    </span>
                  )}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}

      {PRIVILEGED_ROLES.includes(user.role) && (
        <p className="text-[11px] text-muted-foreground">
          Tip: pra subir anúncio direto pelo sistema (Fase 3), preencha o <strong>Meta Ad Account ID</strong> do cliente
          dentro da página de Tráfego dele.
        </p>
      )}
    </div>
  );
}

function KpiTile({ label, value, accent }: { label: string; value: number; accent?: "emerald" }) {
  const accentClass = accent === "emerald" ? "text-emerald-600 dark:text-emerald-400" : "text-foreground";
  return (
    <div className="rounded-lg border bg-card px-4 py-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${accentClass}`}>{value}</p>
    </div>
  );
}
