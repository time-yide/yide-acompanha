"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Camera, Loader2, RefreshCw, AlertTriangle, ExternalLink,
  Search, ChevronDown, ArrowDown, ArrowUp,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { refreshSnapshotsAction } from "@/lib/instagram-snapshots/actions";
import { computeCounts } from "@/lib/instagram-snapshots/counts";
import type { ClienteComSnapshot } from "@/lib/instagram-snapshots/queries";
import type { PostRecente, ScrapeStatus, CountsBucket } from "@/lib/instagram-snapshots/tipos";

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

/** Cor do número do mês baseado em volume (meta aprox 12/mês). */
function corPorVolumeMes(mes: number): string {
  if (mes === 0) return "text-red-500";
  if (mes <= 4) return "text-amber-500";
  if (mes <= 9) return "text-foreground";
  return "text-emerald-500";
}

function instagramHref(raw: string): string {
  if (raw.startsWith("http")) return raw;
  return `https://instagram.com/${raw.replace(/^@/, "").replace(/\/$/, "")}`;
}

type SortKey = "nome" | "mes" | "semana" | "hoje";
type SortDir = "asc" | "desc";

const STATUS_LABEL: Record<ScrapeStatus, string> = {
  ok: "OK",
  profile_not_found: "Privado/não encontrado",
  rate_limit: "Tente em 5 min",
  error: "Erro",
  no_url: "Sem perfil",
};

interface Props {
  clientes: ClienteComSnapshot[];
  titulo?: string;
  /** Se true, esconde o filtro de assessor (caso assessor logado, só vê os próprios). */
  esconderFiltroAssessor?: boolean;
}

interface ClienteEnriched extends ClienteComSnapshot {
  counts: CountsBucket | null;
  status: ScrapeStatus;
}

export function InstagramPostsCard({
  clientes,
  titulo = "Postagens no Instagram",
  esconderFiltroAssessor = false,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [assessorFilter, setAssessorFilter] = useState<string>("__todos__");
  const [sortKey, setSortKey] = useState<SortKey>("mes");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Enriquece todos os clientes (uma vez, derivado).
  const enriched: ClienteEnriched[] = useMemo(() => {
    return clientes.map((c) => {
      const snap = c.ultimo_snapshot;
      const hasUrl = !!c.instagram_url;
      const status: ScrapeStatus = snap?.scrape_status ?? (hasUrl ? "ok" : "no_url");
      const counts: CountsBucket | null =
        snap && snap.scrape_status === "ok"
          ? computeCounts(snap.recent_posts as PostRecente[])
          : null;
      return { ...c, counts, status };
    });
  }, [clientes]);

  // Lista de assessores únicos (pra dropdown).
  const assessores = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of clientes) {
      if (c.assessor_id && c.assessor_nome) {
        map.set(c.assessor_id, c.assessor_nome);
      }
    }
    return Array.from(map.entries())
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [clientes]);

  // Aplica filtros + sort.
  const visiveis = useMemo(() => {
    const q = query.trim().toLowerCase();
    let arr = enriched.filter((c) => {
      if (q && !c.cliente_nome.toLowerCase().includes(q)) return false;
      if (assessorFilter === "__sem__" && c.assessor_id) return false;
      if (assessorFilter !== "__todos__" && assessorFilter !== "__sem__"
          && c.assessor_id !== assessorFilter) return false;
      return true;
    });

    arr = [...arr].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "nome") {
        return a.cliente_nome.localeCompare(b.cliente_nome) * dir;
      }
      const av = a.counts?.[sortKey] ?? -1;
      const bv = b.counts?.[sortKey] ?? -1;
      if (av === bv) return a.cliente_nome.localeCompare(b.cliente_nome);
      return (av - bv) * dir;
    });

    return arr;
  }, [enriched, query, assessorFilter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "nome" ? "asc" : "desc");
    }
  }

  function refreshTodos() {
    const ids = visiveis.filter((c) => c.instagram_url).map((c) => c.cliente_id);
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
              {visiveis.length} de {clientes.length} {clientes.length === 1 ? "cliente" : "clientes"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lastRun && <span className="hidden text-xs text-muted-foreground sm:inline">{lastRun}</span>}
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
            Atualizar visíveis
          </button>
        </div>
      </header>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar cliente..."
            className="h-8 w-full rounded-md border bg-card pl-8 pr-3 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>

        {!esconderFiltroAssessor && (
          <div className="relative">
            <select
              value={assessorFilter}
              onChange={(e) => setAssessorFilter(e.target.value)}
              className="h-8 appearance-none rounded-md border bg-card pl-3 pr-7 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <option value="__todos__">Todos os assessores</option>
              <option value="__sem__">Sem assessor</option>
              {assessores.map((a) => (
                <option key={a.id} value={a.id}>{a.nome}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2">
                <SortHeader label="Cliente" k="nome" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
              </th>
              {!esconderFiltroAssessor && <th className="px-4 py-2">Assessor</th>}
              <th className="px-3 py-2 text-right">
                <SortHeader label="Hoje" k="hoje" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} align="right" />
              </th>
              <th className="px-3 py-2 text-right">
                <SortHeader label="Semana" k="semana" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} align="right" />
              </th>
              <th className="px-3 py-2 text-right">
                <SortHeader label="Mês" k="mes" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} align="right" />
              </th>
              <th className="px-3 py-2 text-xs">Atualizado</th>
              <th className="px-3 py-2 w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {visiveis.length === 0 && (
              <tr>
                <td colSpan={esconderFiltroAssessor ? 6 : 7} className="px-4 py-8 text-center text-xs text-muted-foreground">
                  Nenhum cliente bate com o filtro.
                </td>
              </tr>
            )}
            {visiveis.map((c) => (
              <ClienteRow
                key={c.cliente_id}
                c={c}
                hideAssessor={esconderFiltroAssessor}
                isRefreshing={refreshingId === c.cliente_id || refreshingId === "__all__"}
                onRefresh={() => refreshUm(c.cliente_id)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function SortHeader({
  label, k, sortKey, sortDir, onToggle, align = "left",
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onToggle: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sortKey === k;
  return (
    <button
      type="button"
      onClick={() => onToggle(k)}
      className={`inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider hover:text-foreground ${
        active ? "text-foreground" : "text-muted-foreground"
      } ${align === "right" ? "justify-end" : ""}`}
    >
      {label}
      {active && (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
    </button>
  );
}

function ClienteRow({
  c, hideAssessor, isRefreshing, onRefresh,
}: {
  c: ClienteEnriched;
  hideAssessor: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  const snap = c.ultimo_snapshot;
  const hasUrl = !!c.instagram_url;
  const counts = c.counts;
  const mesCor = counts ? corPorVolumeMes(counts.mes) : "text-muted-foreground/40";

  return (
    <tr className="group hover:bg-muted/30">
      <td className="px-4 py-2">
        <div className="flex items-center gap-2">
          <Link
            href={`/clientes/${c.cliente_id}`}
            className="line-clamp-1 text-sm font-medium hover:underline"
            title={c.cliente_nome}
          >
            {c.cliente_nome}
          </Link>
          {hasUrl && (
            <a
              href={instagramHref(c.instagram_url!)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground transition-colors hover:text-pink-500"
              aria-label="Abrir Instagram"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </td>

      {!hideAssessor && (
        <td className="px-4 py-2 text-xs text-muted-foreground">
          {c.assessor_nome ?? <span className="italic opacity-60">sem assessor</span>}
        </td>
      )}

      {counts ? (
        <>
          <td className="px-3 py-2 text-right text-sm tabular-nums">
            <span className={counts.hoje > 0 ? "font-medium text-foreground" : "text-muted-foreground/60"}>
              {counts.hoje}
            </span>
          </td>
          <td className="px-3 py-2 text-right text-sm tabular-nums">
            <span className={counts.semana > 0 ? "font-medium text-foreground" : "text-muted-foreground/60"}>
              {counts.semana}
            </span>
          </td>
          <td className={`px-3 py-2 text-right text-base font-bold tabular-nums ${mesCor}`}>
            {counts.mes}
          </td>
        </>
      ) : c.status === "no_url" ? (
        <td colSpan={3} className="px-3 py-2 text-right text-xs">
          <Link href={`/clientes/${c.cliente_id}`} className="text-primary hover:underline">
            + Cadastrar perfil
          </Link>
        </td>
      ) : !snap ? (
        <td colSpan={3} className="px-3 py-2 text-right text-xs text-muted-foreground">
          ainda não buscamos
        </td>
      ) : (
        <td colSpan={3} className="px-3 py-2 text-right">
          <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-3 w-3" />
            {STATUS_LABEL[c.status]}
          </span>
        </td>
      )}

      <td className="px-3 py-2 text-xs text-muted-foreground">
        {snap ? timeAgo(snap.scraped_at) : "—"}
      </td>

      <td className="px-3 py-2 text-right">
        {hasUrl && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100 disabled:opacity-50"
            aria-label="Atualizar este cliente"
          >
            {isRefreshing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </td>
    </tr>
  );
}
