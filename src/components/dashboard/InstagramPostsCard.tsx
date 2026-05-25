"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, Loader2, RefreshCw, AlertTriangle, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { refreshSnapshotsAction } from "@/lib/instagram-snapshots/actions";
import { computeCounts } from "@/lib/instagram-snapshots/counts";
import type { ClienteComSnapshot } from "@/lib/instagram-snapshots/queries";
import type { PostRecente, ScrapeStatus } from "@/lib/instagram-snapshots/tipos";

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

const STATUS_LABEL: Record<ScrapeStatus, { label: string; cls: string }> = {
  ok: { label: "OK", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  profile_not_found: { label: "Perfil privado/não encontrado", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  rate_limit: { label: "Tente em 5min", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  error: { label: "Erro", cls: "bg-red-500/15 text-red-700 dark:text-red-300" },
  no_url: { label: "Sem perfil cadastrado", cls: "bg-muted text-muted-foreground" },
};

interface Props {
  clientes: ClienteComSnapshot[];
  /** Título customizável. Sócio vê "Postagens no Instagram (Geral)", assessor "Suas postagens". */
  titulo?: string;
}

export function InstagramPostsCard({ clientes, titulo = "Postagens no Instagram" }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [lastRun, setLastRun] = useState<string | null>(null);

  function refreshTodos() {
    const ids = clientes.filter((c) => c.instagram_url).map((c) => c.cliente_id);
    if (ids.length === 0) return;
    startTransition(async () => {
      const r = await refreshSnapshotsAction(ids);
      if ("error" in r) {
        setLastRun(`Erro: ${r.error}`);
      } else {
        setLastRun(`Atualizado: ${r.refreshed} · Cache: ${r.cached} · Erros: ${r.errors}`);
      }
      router.refresh();
    });
  }

  function refreshUm(clienteId: string) {
    startTransition(async () => {
      await refreshSnapshotsAction([clienteId]);
      router.refresh();
    });
  }

  if (clientes.length === 0) {
    return null; // sem clientes elegíveis → não renderiza
  }

  return (
    <Card className="overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-pink-500" />
          <h2 className="text-sm font-semibold uppercase tracking-wider">{titulo}</h2>
          <span className="text-xs text-muted-foreground">
            ({clientes.length} {clientes.length === 1 ? "cliente" : "clientes"})
          </span>
        </div>
        <div className="flex items-center gap-3">
          {lastRun && <span className="text-xs text-muted-foreground">{lastRun}</span>}
          <button
            type="button"
            onClick={refreshTodos}
            disabled={pending}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-card px-3 text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Atualizar
          </button>
        </div>
      </header>

      <table className="w-full text-sm">
        <thead className="bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-2">Cliente</th>
            <th className="px-4 py-2 text-center">Hoje</th>
            <th className="px-4 py-2 text-center">Semana</th>
            <th className="px-4 py-2 text-center">Mês</th>
            <th className="px-4 py-2">Atualizado</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {clientes.map((c) => {
            const snap = c.ultimo_snapshot;
            const posts: PostRecente[] = snap?.recent_posts ?? [];
            const status: ScrapeStatus = snap?.scrape_status ?? (c.instagram_url ? "ok" : "no_url");
            const counts = status === "ok" ? computeCounts(posts) : null;
            const statusInfo = STATUS_LABEL[status];

            return (
              <tr key={c.cliente_id} className="hover:bg-muted/30">
                <td className="px-4 py-2">
                  <Link href={`/clientes/${c.cliente_id}`} className="font-medium hover:underline">
                    {c.cliente_nome}
                  </Link>
                  {c.instagram_url && (
                    <a
                      href={c.instagram_url.startsWith("http") ? c.instagram_url : `https://instagram.com/${c.instagram_url.replace(/^@/, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 inline-block text-muted-foreground hover:text-pink-500"
                      aria-label="Abrir Instagram"
                    >
                      <ExternalLink className="inline h-3 w-3" />
                    </a>
                  )}
                </td>
                {counts ? (
                  <>
                    <td className="px-4 py-2 text-center font-medium tabular-nums">{counts.hoje}</td>
                    <td className="px-4 py-2 text-center font-medium tabular-nums">{counts.semana}</td>
                    <td className="px-4 py-2 text-center font-medium tabular-nums">{counts.mes}</td>
                  </>
                ) : (
                  <td colSpan={3} className="px-4 py-2 text-center">
                    <Badge variant="outline" className={statusInfo.cls}>
                      {status !== "ok" && <AlertTriangle className="mr-1 inline h-3 w-3" />}
                      {statusInfo.label}
                    </Badge>
                    {status === "no_url" && (
                      <Link href={`/clientes/${c.cliente_id}`} className="ml-2 text-xs text-primary hover:underline">
                        Cadastrar
                      </Link>
                    )}
                  </td>
                )}
                <td className="px-4 py-2 text-xs text-muted-foreground">
                  {snap ? timeAgo(snap.scraped_at) : "—"}
                </td>
                <td className="px-4 py-2 text-right">
                  {c.instagram_url && (
                    <button
                      type="button"
                      onClick={() => refreshUm(c.cliente_id)}
                      disabled={pending}
                      className="text-xs text-primary hover:underline disabled:opacity-50"
                    >
                      Atualizar
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
