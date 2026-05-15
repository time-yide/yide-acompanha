"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Clock,
  AlertCircle,
  CheckCircle2,
  X,
  Inbox,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import {
  CATEGORIA_LABEL,
  STATUS_LABEL,
  STATUSES,
  type Status,
} from "@/lib/portal-requests/schema";
import type { RequestWithCliente } from "@/lib/portal-requests/queries";

interface Props {
  requests: RequestWithCliente[];
}

type SortKey = "created" | "cliente" | "status";
type SortDir = "asc" | "desc";

const STATUS_ICON: Record<Status, React.ReactNode> = {
  aberta: <Clock className="h-3 w-3" />,
  em_andamento: <AlertCircle className="h-3 w-3" />,
  concluida: <CheckCircle2 className="h-3 w-3" />,
  cancelada: <X className="h-3 w-3" />,
};

const STATUS_TONE: Record<Status, string> = {
  aberta: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  em_andamento: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  concluida: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  cancelada: "bg-muted text-muted-foreground",
};

function formatBR(iso: string): string {
  const date = new Date(iso);
  const diffDays = Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) {
    return date.toLocaleTimeString("pt-BR", {
      timeZone: "America/Cuiaba",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (diffDays === 1) return "ontem";
  if (diffDays < 7) return `${diffDays}d atrás`;
  return date.toLocaleDateString("pt-BR", {
    timeZone: "America/Cuiaba",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export function SolicitacoesList({ requests }: Props) {
  const [statusFilter, setStatusFilter] = useState<Set<Status>>(new Set(["aberta", "em_andamento"]));
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = requests.filter((r) => statusFilter.has(r.status));
    if (q) {
      list = list.filter(
        (r) =>
          r.titulo.toLowerCase().includes(q) ||
          r.cliente_nome.toLowerCase().includes(q) ||
          r.descricao.toLowerCase().includes(q),
      );
    }
    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "created") cmp = b.created_at.localeCompare(a.created_at);
      else if (sortKey === "cliente") cmp = a.cliente_nome.localeCompare(b.cliente_nome, "pt-BR");
      else if (sortKey === "status") cmp = a.status.localeCompare(b.status);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [requests, statusFilter, query, sortKey, sortDir]);

  function toggleStatus(s: Status) {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar título, cliente ou descrição…"
          className="h-9 flex-1 min-w-[240px] rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <span className="text-xs text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "solicitação" : "solicitações"}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Status:</span>
        {STATUSES.map((s) => {
          const active = statusFilter.has(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggleStatus(s)}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-opacity ${
                active ? STATUS_TONE[s] : "text-muted-foreground hover:opacity-100 opacity-60"
              }`}
            >
              {STATUS_ICON[s]}
              {STATUS_LABEL[s]}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          <Inbox className="h-10 w-10 text-muted-foreground/40" />
          <p>Nenhuma solicitação nesse filtro.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left">
                  <SortBtn label="Cliente" k="cliente" sortKey={sortKey} sortDir={sortDir} toggle={toggleSort} />
                </th>
                <th className="px-4 py-2.5 text-left">Solicitação</th>
                <th className="px-4 py-2.5 text-left">
                  <SortBtn label="Status" k="status" sortKey={sortKey} sortDir={sortDir} toggle={toggleSort} />
                </th>
                <th className="px-4 py-2.5 text-left">
                  <SortBtn label="Aberta" k="created" sortKey={sortKey} sortDir={sortDir} toggle={toggleSort} />
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b last:border-b-0 hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/solicitacoes/${r.id}`} className="hover:text-primary hover:underline">
                      {r.cliente_nome}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/solicitacoes/${r.id}`} className="block max-w-md">
                      <div className="truncate text-sm">{r.titulo}</div>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span>{CATEGORIA_LABEL[r.categoria]}</span>
                        {r.prioridade === "urgente" && (
                          <span className="rounded-full bg-rose-500/15 px-1.5 py-0.5 font-medium text-rose-700 dark:text-rose-300">
                            Urgente
                          </span>
                        )}
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_TONE[r.status]}`}
                    >
                      {STATUS_ICON[r.status]}
                      {STATUS_LABEL[r.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{formatBR(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SortBtn({
  label,
  k,
  sortKey,
  sortDir,
  toggle,
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  toggle: (k: SortKey) => void;
}) {
  const active = sortKey === k;
  return (
    <button
      type="button"
      onClick={() => toggle(k)}
      className={`inline-flex items-center gap-1 ${active ? "text-foreground" : "hover:text-foreground"}`}
    >
      {label}
      {active && (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
    </button>
  );
}
