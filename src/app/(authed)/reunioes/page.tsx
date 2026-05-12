import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Mic, BarChart3, Settings, Sparkles, Calendar, Search,
} from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { listMeetings, getGoogleConnection } from "@/lib/reunioes/queries";
import { MEETING_STATUS_LABEL, type MeetingStatus } from "@/lib/reunioes/tipos";
import { MeetingCard } from "@/components/reunioes/MeetingCard";
import { ConnectGoogleBanner } from "@/components/reunioes/ConnectGoogleBanner";
import { buttonVariants } from "@/components/ui/button";

const ALLOWED_ROLES = [
  "adm", "socio", "comercial", "coordenador", "assessor",
  "audiovisual_chefe",
];

type Filtro = MeetingStatus | "todos";

const FILTROS: Array<{ id: Filtro; label: string }> = [
  { id: "todos", label: "Todas" },
  { id: "scheduled", label: "Próximas" },
  { id: "in_progress", label: "Em andamento" },
  { id: "processing", label: "Processando" },
  { id: "completed", label: "Concluídas" },
];

export default async function ReunioesPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; q?: string }>;
}) {
  const user = await requireAuth();
  if (!ALLOWED_ROLES.includes(user.role)) notFound();
  const params = await searchParams;

  const filtroAtivo: Filtro =
    (FILTROS.some((f) => f.id === params.filtro) ? (params.filtro as Filtro) : "todos");

  const [meetings, gConnection] = await Promise.all([
    listMeetings({
      status: filtroAtivo === "todos" ? undefined : filtroAtivo,
      searchQuery: params.q,
    }),
    getGoogleConnection(user.id),
  ]);

  const proximas = meetings.filter((m) => m.status === "scheduled");
  const emAndamento = meetings.filter((m) => m.status === "in_progress" || m.status === "processing");
  const concluidas = meetings.filter((m) => m.status === "completed");

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
            <Sparkles className="h-3 w-3" />
            Inteligência de reuniões
          </div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Mic className="h-6 w-6 text-primary" />
            Reuniões
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Inbox unificada das suas calls. Gravação, transcrição, resumo, tópicos, insights
            e tarefas geradas automaticamente por IA depois de cada reunião.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/reunioes/metricas"
            className={buttonVariants({ variant: "outline" })}
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            Métricas
          </Link>
          <Link
            href="/reunioes/conectar"
            className={buttonVariants({ variant: "outline" })}
          >
            <Settings className="mr-2 h-4 w-4" />
            Configurações
          </Link>
        </div>
      </header>

      {/* Banner conectar Google (ou estado conectado) */}
      <ConnectGoogleBanner
        connected={gConnection.connected}
        googleEmail={gConnection.google_email}
      />

      {/* KPI cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiBlock
          icon={Calendar}
          label="Próximas"
          valor={proximas.length}
          helper="Agendadas no calendário"
        />
        <KpiBlock
          icon={Mic}
          label="Em andamento"
          valor={emAndamento.length}
          helper="Gravando ou processando"
          accent="emerald"
        />
        <KpiBlock
          icon={Sparkles}
          label="Concluídas"
          valor={concluidas.length}
          helper="Pronto pra revisar"
        />
        <KpiBlock
          icon={BarChart3}
          label="Tarefas geradas"
          valor={meetings.reduce((s, m) => s + m.tasks_geradas_count, 0)}
          helper="Pela IA, neste período"
          accent="primary"
        />
      </div>

      {/* Toolbar: busca + filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <form className="flex-1 min-w-[240px] max-w-md" action="/reunioes">
          {filtroAtivo !== "todos" && (
            <input type="hidden" name="filtro" value={filtroAtivo} />
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Buscar por título, participante, tag ou conteúdo da transcrição…"
              className="h-9 w-full rounded-lg border bg-card pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/50"
            />
          </div>
        </form>
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTROS.map((f) => {
            const sp = new URLSearchParams();
            if (f.id !== "todos") sp.set("filtro", f.id);
            if (params.q) sp.set("q", params.q);
            const ativa = filtroAtivo === f.id;
            return (
              <Link
                key={f.id}
                href={`/reunioes${sp.toString() ? `?${sp.toString()}` : ""}`}
                scroll={false}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  ativa
                    ? "bg-primary text-primary-foreground"
                    : "border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {f.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Lista */}
      {meetings.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card/50 p-12 text-center">
          <Mic className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium">Nenhuma reunião por aqui ainda</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {gConnection.connected
              ? "Quando você tiver uma reunião no Google Meet, ela aparece aqui automaticamente."
              : "Conecte sua conta Google pra começar a capturar reuniões."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {meetings.map((m) => (
            <MeetingCard key={m.id} meeting={m} />
          ))}
        </div>
      )}
    </div>
  );
}

function KpiBlock({
  icon: Icon, label, valor, helper, accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  valor: number;
  helper: string;
  accent?: "primary" | "emerald";
}) {
  const accentClass =
    accent === "emerald"
      ? "text-emerald-600 dark:text-emerald-400"
      : accent === "primary"
        ? "text-primary"
        : "text-foreground";
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className={`h-3.5 w-3.5 ${accentClass}`} />
      </div>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${accentClass}`}>{valor}</p>
      <p className="text-[11px] text-muted-foreground">{helper}</p>
    </div>
  );
}

// Suprime warning de variável não usada (mantemos export pra futura referência)
void MEETING_STATUS_LABEL;
