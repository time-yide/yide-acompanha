import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, Images, Video, ListChecks, MapPin, ExternalLink } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { getStoriesGridForMonth, getClientesElegiveisStories } from "@/lib/painel/stories-queries";
import { AdicionarClienteStoriesDialog } from "@/components/fast-media/AdicionarClienteStoriesDialog";
import { getFastMidiaDemandas } from "@/lib/fast-media/queries";
import { getClientIdsForActiveUnit } from "@/lib/units/filter-helpers";
import { getCurrentMonthYM, APP_TIMEZONE } from "@/lib/datetime/timezone";
import { localIsoDate } from "@/lib/utils/date";
import { StoriesMonthGrid } from "@/components/fast-media/StoriesMonthGrid";
import { Card } from "@/components/ui/card";

const ROLES_QUE_VEEM = ["fast_midia", "adm", "socio", "coordenador", "audiovisual_chefe"];
const ROLES_QUE_MARCAM = ["fast_midia", "adm", "socio", "coordenador"];
const MANAGER_ROLES = ["adm", "socio", "coordenador", "audiovisual_chefe"];

const STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  alteracao: "Alteração",
  em_aprovacao: "Em aprovação",
  aprovada: "Aprovada",
  agendado: "Agendado",
};

function shiftMonth(mesRef: string, delta: number): string {
  const [y, m] = mesRef.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(mesRef: string): string {
  const [y, m] = mesRef.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: APP_TIMEZONE,
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "sem prazo";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return String(iso);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR");
}

export default async function FastMediaPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const user = await requireAuth();
  if (!ROLES_QUE_VEEM.includes(user.role)) notFound();

  const { mes: mesParam } = await searchParams;
  const mesRef = mesParam && /^\d{4}-\d{2}$/.test(mesParam) ? mesParam : getCurrentMonthYM();
  const canEdit = ROLES_QUE_MARCAM.includes(user.role);
  const isManager = MANAGER_ROLES.includes(user.role);

  const unitClientIds = await getClientIdsForActiveUnit();
  const [storiesRows, demandas, clientesElegiveis] = await Promise.all([
    getStoriesGridForMonth(mesRef, unitClientIds),
    getFastMidiaDemandas(user.id, user.role),
    canEdit ? getClientesElegiveisStories(unitClientIds) : Promise.resolve([]),
  ]);

  const totalPostados = storiesRows.reduce((s, r) => s + r.postados, 0);
  const totalMeta = storiesRows.reduce((s, r) => s + r.meta, 0);
  const todayIso = localIsoDate();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Fast Mídia</h1>
        <p className="text-sm text-muted-foreground">Controle de stories por dia e demandas da equipe.</p>
      </header>

      {/* Seção A: Stories */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-foreground/80">
            <Images className="h-4 w-4" /> Stories
            {totalMeta > 0 && (
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                {totalPostados}/{totalMeta} no mês
              </span>
            )}
          </h2>
          <div className="flex items-center gap-2">
            {canEdit && <AdicionarClienteStoriesDialog clientesElegiveis={clientesElegiveis} />}
            <div className="flex items-center gap-1 rounded-lg border bg-card p-0.5">
              <Link
                href={`/fast-media?mes=${shiftMonth(mesRef, -1)}`}
                className="rounded-md p-1 hover:bg-muted"
                aria-label="Mês anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Link>
              <span className="min-w-[7.5rem] text-center text-sm font-medium capitalize">{monthLabel(mesRef)}</span>
              <Link
                href={`/fast-media?mes=${shiftMonth(mesRef, 1)}`}
                className="rounded-md p-1 hover:bg-muted"
                aria-label="Próximo mês"
              >
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
        <StoriesMonthGrid rows={storiesRows} canEdit={canEdit} todayIso={todayIso} />
      </section>

      {/* Seção B: Demandas */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-foreground/80">
          <ListChecks className="h-4 w-4" />
          {isManager ? "Demandas da equipe Fast Mídia" : "Minhas demandas"}
        </h2>

        {demandas.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">Nenhum Fast Mídia ativo.</Card>
        ) : (
          <div className="space-y-3">
            {demandas.map((d) => {
              const vazio = d.gravacoes.length === 0 && d.tarefas.length === 0;
              return (
                <Card key={d.id} className="space-y-3 p-4">
                  {isManager && <p className="text-sm font-semibold">{d.nome}</p>}

                  {vazio ? (
                    <p className="text-xs text-muted-foreground">Sem gravações ou tarefas em aberto.</p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          <Video className="h-3.5 w-3.5" /> Gravações ({d.gravacoes.length})
                        </p>
                        {d.gravacoes.length === 0 ? (
                          <p className="text-xs text-muted-foreground">—</p>
                        ) : (
                          d.gravacoes.map((g) => (
                            <Link
                              key={g.id}
                              href="/calendario"
                              className="block rounded-lg border bg-card px-2.5 py-1.5 hover:bg-muted/40"
                            >
                              <p className="truncate text-[13px] font-medium">{g.titulo}</p>
                              <p className="text-[11px] text-muted-foreground">{fmtDateTime(g.inicio)}</p>
                              {g.localizacao_endereco && (
                                <p className="flex items-start gap-1 text-[11px] text-muted-foreground">
                                  <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                                  <span className="truncate">{g.localizacao_endereco}</span>
                                </p>
                              )}
                            </Link>
                          ))
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          <ListChecks className="h-3.5 w-3.5" /> Tarefas em aberto ({d.tarefas.length})
                        </p>
                        {d.tarefas.length === 0 ? (
                          <p className="text-xs text-muted-foreground">—</p>
                        ) : (
                          d.tarefas.map((t) => (
                            <Link
                              key={t.id}
                              href={`/tarefas/${t.id}`}
                              className="group flex items-start justify-between gap-2 rounded-lg border bg-card px-2.5 py-1.5 hover:bg-muted/40"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-[13px] font-medium">{t.titulo}</p>
                                <p className="text-[11px] text-muted-foreground">
                                  {STATUS_LABEL[t.status] ?? t.status} · {fmtDate(t.due_date)}
                                </p>
                              </div>
                              <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100" />
                            </Link>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
