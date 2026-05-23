"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Star, ExternalLink, ArrowUp, ArrowDown, Minus } from "lucide-react";
import type { GmbClienteRow } from "@/lib/painel-gmb/queries";

interface Props {
  clientes: GmbClienteRow[];
}

type SortKey = "nome" | "rating" | "reviews" | "delta_rating" | "updated";
type SortDir = "asc" | "desc";

function compareByKey(a: GmbClienteRow, b: GmbClienteRow, key: SortKey): number {
  switch (key) {
    case "nome":
      return a.nome.localeCompare(b.nome, "pt-BR");
    case "rating":
      return (b.gmb_rating ?? -1) - (a.gmb_rating ?? -1);
    case "reviews":
      return (b.gmb_review_count ?? -1) - (a.gmb_review_count ?? -1);
    case "delta_rating":
      return (b.rating_delta_30d ?? -999) - (a.rating_delta_30d ?? -999);
    case "updated":
      return (b.gmb_last_update_at ?? "").localeCompare(a.gmb_last_update_at ?? "");
  }
}

function formatLastUpdate(iso: string | null): string {
  if (!iso) return "-";
  const date = new Date(iso);
  const diffDays = Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return "hoje";
  if (diffDays === 1) return "ontem";
  if (diffDays < 7) return `${diffDays}d atrás`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}sem atrás`;
  return date.toLocaleDateString("pt-BR", {
    timeZone: "America/Cuiaba",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export function PainelGmbList({ clientes }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("nome");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = q
      ? clientes.filter((c) => c.nome.toLowerCase().includes(q))
      : clientes;
    list = [...list].sort((a, b) => {
      const cmp = compareByKey(a, b, sortKey);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [clientes, sortKey, sortDir, query]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "nome" ? "asc" : "desc");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar cliente…"
          className="h-9 flex-1 min-w-[200px] rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <span className="text-xs text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "cliente" : "clientes"}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 text-left">
                <SortBtn label="Cliente" k="nome" sortKey={sortKey} sortDir={sortDir} toggle={toggleSort} />
              </th>
              <th className="px-4 py-2.5 text-right">
                <SortBtn label="Nota" k="rating" sortKey={sortKey} sortDir={sortDir} toggle={toggleSort} />
              </th>
              <th className="px-4 py-2.5 text-right">
                <SortBtn label="Reviews" k="reviews" sortKey={sortKey} sortDir={sortDir} toggle={toggleSort} />
              </th>
              <th className="px-4 py-2.5 text-right">
                <SortBtn label="Δ 30d" k="delta_rating" sortKey={sortKey} sortDir={sortDir} toggle={toggleSort} />
              </th>
              <th className="px-4 py-2.5 text-left">
                <SortBtn label="Atualizado" k="updated" sortKey={sortKey} sortDir={sortDir} toggle={toggleSort} />
              </th>
              <th className="px-4 py-2.5 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  {query ? "Nenhum cliente encontrado pra essa busca." : "Nenhum cliente com GMB cadastrado ainda."}
                </td>
              </tr>
            )}
            {filtered.map((c) => (
              <tr key={c.id} className="border-b last:border-b-0 hover:bg-muted/20">
                <td className="px-4 py-3 font-medium">
                  <Link
                    href={`/painel-gmb/${c.id}`}
                    className="hover:text-primary hover:underline"
                  >
                    {c.nome}
                  </Link>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {c.gmb_rating !== null ? (
                    <span className="inline-flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                      <span className="font-semibold">{c.gmb_rating.toFixed(1)}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {c.gmb_review_count !== null ? (
                    c.gmb_review_count.toLocaleString("pt-BR")
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <DeltaBadge value={c.rating_delta_30d} suffix="" />
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {formatLastUpdate(c.gmb_last_update_at)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {c.gmb_link && (
                      <a
                        href={c.gmb_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] hover:bg-muted"
                        title="Abrir no Google Maps"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    <Link
                      href={`/painel-gmb/${c.id}`}
                      className="rounded-md border px-2 py-1 text-[11px] hover:bg-muted"
                    >
                      Detalhes
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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

function DeltaBadge({ value, suffix }: { value: number | null; suffix: string }) {
  if (value === null) return <span className="text-muted-foreground">-</span>;
  if (value === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" />
        0{suffix}
      </span>
    );
  }
  const cls = value > 0
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-rose-600 dark:text-rose-400";
  const sign = value > 0 ? "+" : "";
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${cls}`}>
      {value > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {sign}
      {value.toFixed(value % 1 === 0 ? 0 : 2)}
      {suffix}
    </span>
  );
}
