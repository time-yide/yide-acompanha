"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, Loader2, RefreshCw, AlertTriangle, ExternalLink, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { refreshSnapshotsAction } from "@/lib/instagram-snapshots/actions";
import { computeCounts } from "@/lib/instagram-snapshots/counts";
import type { ClienteComSnapshot } from "@/lib/instagram-snapshots/queries";
import type { PostRecente, ScrapeStatus, CountsBucket } from "@/lib/instagram-snapshots/tipos";

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

/** Classes de cor pro número do mês baseado em volume (meta aproximada ~12/mês). */
function corPorVolumeMes(mes: number): { accent: string; bar: string } {
  if (mes === 0) return { accent: "text-red-500", bar: "bg-red-500/60" };
  if (mes <= 4) return { accent: "text-amber-500", bar: "bg-amber-500/60" };
  if (mes <= 9) return { accent: "text-foreground", bar: "bg-foreground/30" };
  return { accent: "text-emerald-500", bar: "bg-emerald-500/60" };
}

function instagramHref(raw: string): string {
  if (raw.startsWith("http")) return raw;
  return `https://instagram.com/${raw.replace(/^@/, "").replace(/\/$/, "")}`;
}

const STATUS_LABEL: Record<ScrapeStatus, string> = {
  ok: "OK",
  profile_not_found: "Perfil privado ou não encontrado",
  rate_limit: "Tente em 5 min",
  error: "Erro ao buscar",
  no_url: "Sem perfil cadastrado",
};

interface Props {
  clientes: ClienteComSnapshot[];
  titulo?: string;
}

export function InstagramPostsCard({ clientes, titulo = "Postagens no Instagram" }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<string | null>(null);

  function refreshTodos() {
    const ids = clientes.filter((c) => c.instagram_url).map((c) => c.cliente_id);
    if (ids.length === 0) return;
    setRefreshingId("__all__");
    startTransition(async () => {
      const r = await refreshSnapshotsAction(ids);
      setRefreshingId(null);
      if ("error" in r) {
        setLastRun(`Erro: ${r.error}`);
      } else {
        setLastRun(`${r.refreshed} atualizados · ${r.cached} do cache · ${r.errors} erros`);
      }
      router.refresh();
    });
  }

  function refreshUm(clienteId: string) {
    setRefreshingId(clienteId);
    startTransition(async () => {
      await refreshSnapshotsAction([clienteId]);
      setRefreshingId(null);
      router.refresh();
    });
  }

  if (clientes.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-gradient-to-r from-pink-500/5 via-card to-card px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-500/15 text-pink-500">
            <Camera className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider">{titulo}</h2>
            <p className="text-xs text-muted-foreground">
              {clientes.length} {clientes.length === 1 ? "cliente" : "clientes"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastRun && <span className="text-xs text-muted-foreground">{lastRun}</span>}
          <button
            type="button"
            onClick={refreshTodos}
            disabled={pending}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-card px-3 text-xs font-medium shadow-sm hover:bg-muted disabled:opacity-50"
          >
            {refreshingId === "__all__" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Atualizar tudo
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {clientes.map((c) => (
          <ClienteCard
            key={c.cliente_id}
            cliente={c}
            isRefreshing={refreshingId === c.cliente_id || refreshingId === "__all__"}
            onRefresh={() => refreshUm(c.cliente_id)}
          />
        ))}
      </div>
    </Card>
  );
}

function ClienteCard({
  cliente,
  isRefreshing,
  onRefresh,
}: {
  cliente: ClienteComSnapshot;
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  const snap = cliente.ultimo_snapshot;
  const hasUrl = !!cliente.instagram_url;
  const hasSnapshot = !!snap;
  const status: ScrapeStatus = snap?.scrape_status ?? (hasUrl ? "ok" : "no_url");

  // Só calcula contagens se temos snapshot OK. Se snap=null com url, fica "nunca atualizado".
  const counts: CountsBucket | null =
    snap && snap.scrape_status === "ok" ? computeCounts(snap.recent_posts as PostRecente[]) : null;

  const color = counts ? corPorVolumeMes(counts.mes) : { accent: "text-muted-foreground", bar: "bg-muted" };

  return (
    <div className="group relative overflow-hidden rounded-lg border bg-card p-3 transition-colors hover:border-pink-500/40">
      {/* Barra colorida lateral */}
      <div className={`absolute inset-y-0 left-0 w-1 ${color.bar}`} />

      <header className="mb-2 flex items-start justify-between gap-2 pl-2">
        <Link
          href={`/clientes/${cliente.cliente_id}`}
          className="line-clamp-1 text-sm font-semibold hover:underline"
          title={cliente.cliente_nome}
        >
          {cliente.cliente_nome}
        </Link>
        {hasUrl && (
          <a
            href={instagramHref(cliente.instagram_url!)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground transition-colors hover:text-pink-500"
            aria-label="Abrir Instagram"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </header>

      <div className="pl-2">
        {counts ? (
          <CountsDisplay counts={counts} accent={color.accent} />
        ) : status === "no_url" ? (
          <SemPerfil clienteId={cliente.cliente_id} />
        ) : !hasSnapshot ? (
          <NuncaAtualizado isRefreshing={isRefreshing} onRefresh={onRefresh} />
        ) : (
          <StatusError status={status} />
        )}
      </div>

      <footer className="mt-3 flex items-center justify-between pl-2 text-[10px] text-muted-foreground">
        <span>{snap ? `Atualizado ${timeAgo(snap.scraped_at)}` : "Sem dados"}</span>
        {hasUrl && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1 text-primary opacity-0 transition-opacity hover:underline group-hover:opacity-100 disabled:opacity-50"
          >
            {isRefreshing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            Atualizar
          </button>
        )}
      </footer>
    </div>
  );
}

function CountsDisplay({ counts, accent }: { counts: CountsBucket; accent: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline gap-2">
        <span className={`text-3xl font-bold tabular-nums leading-none ${accent}`}>
          {counts.mes}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          posts no mês
        </span>
      </div>
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <span>
          <span className="font-semibold tabular-nums text-foreground">{counts.hoje}</span> hoje
        </span>
        <span className="text-muted-foreground/30">·</span>
        <span>
          <span className="font-semibold tabular-nums text-foreground">{counts.semana}</span> esta semana
        </span>
      </div>
    </div>
  );
}

function NuncaAtualizado({ isRefreshing, onRefresh }: { isRefreshing: boolean; onRefresh: () => void }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold tabular-nums leading-none text-muted-foreground/40">—</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          ainda não buscamos
        </span>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={isRefreshing}
        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50"
      >
        {isRefreshing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
        Buscar agora
      </button>
    </div>
  );
}

function SemPerfil({ clienteId }: { clienteId: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold leading-none text-muted-foreground/40">—</span>
      </div>
      <Link
        href={`/clientes/${clienteId}`}
        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        <Plus className="h-3 w-3" />
        Cadastrar perfil
      </Link>
    </div>
  );
}

function StatusError({ status }: { status: ScrapeStatus }) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-700 dark:text-amber-300">
      <AlertTriangle className="h-3 w-3 flex-shrink-0" />
      <span className="line-clamp-2">{STATUS_LABEL[status]}</span>
    </div>
  );
}
