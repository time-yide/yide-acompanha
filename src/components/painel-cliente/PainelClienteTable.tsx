"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConcederAcessoDialog } from "./ConcederAcessoDialog";
import { ResetPasswordDialog } from "./ResetPasswordDialog";
import { RevogarAcessoButton } from "./RevogarAcessoButton";
import { CopyLinkButton } from "./CopyLinkButton";
import { MAX_ACESSOS_ATIVOS_POR_CLIENTE } from "@/lib/painel-cliente/constants";
import type { ClienteComAcesso, PortalUser } from "@/lib/painel-cliente/queries";

interface Props {
  rows: ClienteComAcesso[];
  loginUrl: string;
}

type ClientStatus = "ativo" | "revogado" | "sem_acesso";
type FilterKey = "todos" | "com_acesso" | "sem_acesso" | "revogados";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Cuiaba",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getClientStatus(r: ClienteComAcesso): ClientStatus {
  if (r.portals.length === 0) return "sem_acesso";
  if (r.portals.some((p) => p.ativo)) return "ativo";
  return "revogado";
}

function getMaxLastLogin(portals: PortalUser[]): string | null {
  const ativos = portals.filter((p) => p.ativo && p.last_login_at);
  if (ativos.length === 0) return null;
  return ativos
    .map((p) => p.last_login_at as string)
    .sort((a, b) => b.localeCompare(a))[0];
}

function describePortals(portals: PortalUser[]): string {
  if (portals.length === 0) return "Sem acesso";
  const ativos = portals.filter((p) => p.ativo).length;
  const revogados = portals.length - ativos;
  if (ativos === 0) return `${revogados} revogado${revogados > 1 ? "s" : ""}`;
  if (revogados === 0) return `${ativos} ativo${ativos > 1 ? "s" : ""}`;
  return `${ativos} ativo${ativos > 1 ? "s" : ""} · ${revogados} revogado${revogados > 1 ? "s" : ""}`;
}

export function PainelClienteTable({ rows, loginUrl }: Props) {
  const [filter, setFilter] = useState<FilterKey>("todos");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [conceder, setConceder] = useState<{ clientId: string; clientNome: string } | null>(null);
  const [reset, setReset] = useState<{ userId: string; clientNome: string } | null>(null);

  const filtered = rows.filter((r) => {
    const status = getClientStatus(r);
    if (filter === "com_acesso") return status === "ativo";
    if (filter === "sem_acesso") return status === "sem_acesso";
    if (filter === "revogados") return status === "revogado";
    return true;
  });

  function toggleExpand(clientId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button
          type="button"
          onClick={() => setFilter("todos")}
          className={filter === "todos" ? "font-semibold text-primary" : "text-muted-foreground hover:text-foreground"}
        >
          Todos
        </button>
        <span className="text-muted-foreground">·</span>
        <button
          type="button"
          onClick={() => setFilter("com_acesso")}
          className={filter === "com_acesso" ? "font-semibold text-primary" : "text-muted-foreground hover:text-foreground"}
        >
          Com acesso
        </button>
        <span className="text-muted-foreground">·</span>
        <button
          type="button"
          onClick={() => setFilter("sem_acesso")}
          className={filter === "sem_acesso" ? "font-semibold text-primary" : "text-muted-foreground hover:text-foreground"}
        >
          Sem acesso
        </button>
        <span className="text-muted-foreground">·</span>
        <button
          type="button"
          onClick={() => setFilter("revogados")}
          className={filter === "revogados" ? "font-semibold text-primary" : "text-muted-foreground hover:text-foreground"}
        >
          Revogados
        </button>
      </div>

      <div className="rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Cliente</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Acessos</th>
              <th className="px-4 py-3 text-left">Último login</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                  Nenhum cliente neste filtro.
                </td>
              </tr>
            )}
            {filtered.map((r) => {
              const status = getClientStatus(r);
              const ativosCount = r.portals.filter((p) => p.ativo).length;
              const isExpanded = expanded.has(r.client_id);
              const canExpand = r.portals.length > 0;

              return (
                <ClienteRowGroup
                  key={r.client_id}
                  r={r}
                  status={status}
                  ativosCount={ativosCount}
                  isExpanded={isExpanded}
                  canExpand={canExpand}
                  onToggle={() => toggleExpand(r.client_id)}
                  onConceder={() =>
                    setConceder({ clientId: r.client_id, clientNome: r.client_nome })
                  }
                  onReset={(userId) =>
                    setReset({ userId, clientNome: r.client_nome })
                  }
                  loginUrl={loginUrl}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {conceder && (
        <ConcederAcessoDialog
          clientId={conceder.clientId}
          clientNome={conceder.clientNome}
          loginUrl={loginUrl}
          onClose={() => setConceder(null)}
        />
      )}
      {reset && (
        <ResetPasswordDialog
          userId={reset.userId}
          clientNome={reset.clientNome}
          loginUrl={loginUrl}
          onClose={() => setReset(null)}
        />
      )}
    </div>
  );
}

interface ClienteRowGroupProps {
  r: ClienteComAcesso;
  status: ClientStatus;
  ativosCount: number;
  isExpanded: boolean;
  canExpand: boolean;
  onToggle: () => void;
  onConceder: () => void;
  onReset: (userId: string) => void;
  loginUrl: string;
}

function ClienteRowGroup({
  r,
  status,
  ativosCount,
  isExpanded,
  canExpand,
  onToggle,
  onConceder,
  onReset,
  loginUrl,
}: ClienteRowGroupProps) {
  const maxLastLogin = getMaxLastLogin(r.portals);
  const canAdd = ativosCount < MAX_ACESSOS_ATIVOS_POR_CLIENTE;

  return (
    <>
      <tr
        className={`border-b last:border-b-0 ${canExpand ? "cursor-pointer hover:bg-muted/20" : ""}`}
        onClick={canExpand ? onToggle : undefined}
      >
        <td className="px-4 py-3 font-medium">
          <div className="flex items-center gap-2">
            {canExpand ? (
              <ChevronRight
                className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`}
              />
            ) : (
              <span className="inline-block w-4" aria-hidden />
            )}
            {r.client_nome}
          </div>
        </td>
        <td className="px-4 py-3">
          {status === "sem_acesso" ? (
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              Sem acesso
            </span>
          ) : status === "ativo" ? (
            <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-700 dark:text-emerald-300">
              Ativo
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] text-destructive">
              Revogado
            </span>
          )}
        </td>
        <td className="px-4 py-3 text-muted-foreground">{describePortals(r.portals)}</td>
        <td className="px-4 py-3 text-muted-foreground">{formatDate(maxLastLogin)}</td>
        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
          {status === "sem_acesso" ? (
            <Button size="sm" onClick={onConceder}>
              Conceder acesso
            </Button>
          ) : status === "revogado" ? (
            <Button size="sm" onClick={onConceder}>
              Conceder novo
            </Button>
          ) : (
            <CopyLinkButton loginUrl={loginUrl} />
          )}
        </td>
      </tr>

      {isExpanded && canExpand && (
        <tr className="border-b bg-muted/10">
          <td colSpan={5} className="px-4 py-3">
            <div className="ml-6 space-y-2">
              <table className="w-full text-xs">
                <thead className="text-[11px] uppercase tracking-wider text-muted-foreground/70">
                  <tr>
                    <th className="py-1.5 text-left font-medium">Contato</th>
                    <th className="py-1.5 text-left font-medium">Email</th>
                    <th className="py-1.5 text-left font-medium">Status</th>
                    <th className="py-1.5 text-left font-medium">Último login</th>
                    <th className="py-1.5 text-right font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {r.portals.map((p) => (
                    <tr key={p.user_id} className="border-t border-border/40">
                      <td className="py-2">{p.nome_contato ?? "—"}</td>
                      <td className="py-2 text-muted-foreground">{p.email}</td>
                      <td className="py-2">
                        {p.ativo ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-300">
                            Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] text-destructive">
                            Revogado
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {formatDate(p.last_login_at)}
                      </td>
                      <td className="py-2 text-right">
                        {p.ativo ? (
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onReset(p.user_id)}
                            >
                              Resetar senha
                            </Button>
                            <RevogarAcessoButton
                              userId={p.user_id}
                              clientNome={r.client_nome}
                            />
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" onClick={onConceder}>
                            Conceder novo
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="pt-1">
                {canAdd ? (
                  <Button size="sm" variant="ghost" onClick={onConceder}>
                    + Adicionar acesso de sócio
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled
                    title={`Limite de ${MAX_ACESSOS_ATIVOS_POR_CLIENTE} acessos ativos por cliente`}
                  >
                    + Adicionar acesso de sócio (limite de {MAX_ACESSOS_ATIVOS_POR_CLIENTE})
                  </Button>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
