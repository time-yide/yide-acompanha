import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, Calendar, Check, Lock, Sparkles, Shield, AlertCircle,
  FileText, Mic, ListChecks, CheckCircle2, RefreshCw,
} from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { getGoogleConnection } from "@/lib/reunioes/queries";
import { GOOGLE_OAUTH_SCOPES } from "@/lib/reunioes/google/oauth";
import { GoogleConnectButton, GoogleDisconnectButton } from "@/components/reunioes/GoogleConnectButton";

const ALLOWED_ROLES = [
  "adm", "socio", "comercial", "coordenador", "assessor", "audiovisual_chefe",
];

const ERROR_LABELS: Record<string, string> = {
  invalid_state: "Falha de segurança no fluxo OAuth (state CSRF inválido). Tente conectar novamente.",
  missing_params: "Resposta inválida do Google. Tente conectar novamente.",
  not_authenticated: "Sua sessão expirou. Faça login e tente conectar de novo.",
  token_exchange_failed: "Google rejeitou a troca de tokens. Confira as credenciais OAuth no servidor.",
  no_refresh_token: "Google não devolveu refresh_token. Geralmente significa que você já tinha autorizado antes — revogue o acesso em myaccount.google.com/permissions e tente novamente.",
  userinfo_failed: "Não conseguimos pegar seu email no Google. Tente de novo.",
  no_organization: "Seu perfil interno não tem organização configurada. Avise o admin.",
  db_upsert_failed: "Erro ao salvar a conexão no banco. Tente novamente.",
  migration_pending: "O schema do módulo Reuniões ainda não foi aplicado no banco. Avise o admin.",
  access_denied: "Você negou o acesso. Sem permissão de leitura do Calendar não conseguimos listar suas reuniões.",
};

function formatSyncDate(iso: string | null): string {
  if (!iso) return "ainda não sincronizou";
  const d = new Date(iso);
  const diffMin = (Date.now() - d.getTime()) / 60000;
  if (diffMin < 1) return "agora mesmo";
  if (diffMin < 60) return `há ${Math.floor(diffMin)} min`;
  if (diffMin < 1440) return `há ${Math.floor(diffMin / 60)}h`;
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default async function ConectarReunioesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const user = await requireAuth();
  if (!ALLOWED_ROLES.includes(user.role)) notFound();
  const params = await searchParams;
  const gConnection = await getGoogleConnection(user.id);

  const credsConfigured = !!(
    process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/reunioes"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        Voltar para Reuniões
      </Link>

      {/* Hero */}
      <header className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-card p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-12 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-12 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" />

        <div className="relative space-y-3">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
            <Sparkles className="h-3 w-3" />
            Configuração
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Conecte sua conta Google
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Sincronize sua agenda do Google Calendar com o sistema. Toda reunião do Google Meet
            aparece aqui em tempo real — antes, durante e depois da call.
          </p>
        </div>
      </header>

      {/* Status messages */}
      {params.status === "connected" && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <p className="text-xs text-emerald-700 dark:text-emerald-300">
            Conexão criada com sucesso! A primeira sincronização do calendário acontece automaticamente em até 5 minutos.
          </p>
        </div>
      )}
      {params.status === "disconnected" && (
        <div className="flex items-start gap-3 rounded-xl border bg-muted/30 px-4 py-3">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Conexão Google removida. As reuniões já sincronizadas continuam disponíveis no histórico.
          </p>
        </div>
      )}
      {params.error && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/5 px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
          <p className="text-xs text-rose-700 dark:text-rose-300">
            {ERROR_LABELS[params.error] ?? `Erro: ${params.error}`}
          </p>
        </div>
      )}

      {/* Aviso credenciais não configuradas (só pra adm) */}
      {!credsConfigured && (user.role === "adm" || user.role === "socio") && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="text-xs">
            <p className="font-medium text-amber-700 dark:text-amber-300">
              Credenciais Google OAuth não configuradas
            </p>
            <p className="mt-0.5 text-muted-foreground">
              Defina <code className="rounded bg-muted px-1 py-0.5">GOOGLE_OAUTH_CLIENT_ID</code> e
              <code className="ml-1 rounded bg-muted px-1 py-0.5">GOOGLE_OAUTH_CLIENT_SECRET</code> nas
              variáveis do ambiente (Vercel). Veja
              <code className="ml-1 rounded bg-muted px-1 py-0.5">docs/reunioes-roadmap.md</code>.
            </p>
          </div>
        </div>
      )}

      {/* Status atual */}
      {gConnection.connected ? (
        <section className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="rounded-full bg-emerald-500/15 p-2.5 shrink-0">
                <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="font-medium">Conta conectada</p>
                <p className="truncate text-sm text-muted-foreground">{gConnection.google_email}</p>
                <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <RefreshCw className="h-3 w-3" />
                  Última sincronização: {formatSyncDate(gConnection.calendar_last_synced_at)}
                </p>
              </div>
            </div>
            <GoogleDisconnectButton />
          </div>
        </section>
      ) : (
        <section className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="rounded-full bg-muted p-2.5 shrink-0">
                <Calendar className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="font-medium">Nenhuma conta conectada</p>
                <p className="text-xs text-muted-foreground">
                  Vamos pedir acesso apenas pra sua agenda — leitura, nada de escrita.
                </p>
              </div>
            </div>
            <GoogleConnectButton disabled={!credsConfigured} />
          </div>
        </section>
      )}

      {/* O que vamos acessar */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wider text-foreground/80">
          <Shield className="h-3.5 w-3.5 text-emerald-500" />
          O que vamos acessar
        </h2>
        <div className="rounded-xl border bg-card divide-y">
          <ScopeRow
            label="Ver eventos do calendário"
            descricao="Pra listar suas reuniões aqui no sistema antes/depois delas acontecerem."
            scope="calendar.readonly"
          />
          <ScopeRow
            label="Ver detalhes de cada evento"
            descricao="Pegar título, participantes, link do Meet e descrição."
            scope="calendar.events.readonly"
          />
          <ScopeRow
            label="Seu email e perfil básico"
            descricao="Pra associar a conexão à sua conta no Yide."
            scope="openid email profile"
          />
        </div>
        <p className="flex items-start gap-2 text-[11px] text-muted-foreground">
          <Lock className="mt-0.5 h-3 w-3 shrink-0" />
          Não pedimos acesso pra ler emails, criar eventos, modificar agenda nem acessar Drive.
          Você revoga o acesso a qualquer momento em
          <Link href="https://myaccount.google.com/permissions" target="_blank" className="underline ml-1">
            myaccount.google.com
          </Link>.
        </p>
      </section>

      {/* O que ganha conectando */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground/80">
          O que você ganha
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          <FeatureCard
            icon={Calendar}
            titulo="Reuniões aparecem automaticamente"
            desc="Toda reunião do Meet vira um card aqui — antes, durante e depois da call."
          />
          <FeatureCard
            icon={Mic}
            titulo="Gravação + transcrição"
            desc="A IA grava, separa quem falou e gera transcrição completa em português."
          />
          <FeatureCard
            icon={Sparkles}
            titulo="Resumo + tópicos + insights"
            desc="Resumo executivo, tópicos com timestamps, decisões, sinais de compra e objeções."
          />
          <FeatureCard
            icon={ListChecks}
            titulo="Tarefas geradas automaticamente"
            desc="Próximos passos viram tarefas atribuídas — com 1 clique você confirma."
          />
        </div>
      </section>

      {/* Detalhes técnicos */}
      <details className="rounded-xl border bg-card/50 p-4">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <FileText className="mr-1 inline h-3 w-3" />
          Detalhes técnicos (escopos OAuth)
        </summary>
        <ul className="mt-3 space-y-1 text-xs font-mono text-muted-foreground">
          {GOOGLE_OAUTH_SCOPES.map((s) => (
            <li key={s}>• {s}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function ScopeRow({ label, descricao, scope }: { label: string; descricao: string; scope: string }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{descricao}</p>
      </div>
      <code className="hidden text-[10px] text-muted-foreground sm:block">{scope}</code>
    </div>
  );
}

function FeatureCard({
  icon: Icon, titulo, desc,
}: {
  icon: React.ComponentType<{ className?: string }>;
  titulo: string;
  desc: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <Icon className="h-5 w-5 text-primary" />
      <p className="mt-2 text-sm font-medium">{titulo}</p>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}
