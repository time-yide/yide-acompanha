"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConcederAcessoDialog } from "./ConcederAcessoDialog";
import { ResetPasswordDialog } from "./ResetPasswordDialog";
import { RevogarAcessoButton } from "./RevogarAcessoButton";
import type { ClienteComAcesso } from "@/lib/painel-cliente/queries";

interface Props {
  rows: ClienteComAcesso[];
}

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

export function PainelClienteTable({ rows }: Props) {
  const [filter, setFilter] = useState<"todos" | "com_acesso" | "sem_acesso" | "revogados">("todos");
  const [conceder, setConceder] = useState<{ clientId: string; clientNome: string } | null>(null);
  const [reset, setReset] = useState<{ userId: string; clientNome: string } | null>(null);

  const filtered = rows.filter((r) => {
    if (filter === "com_acesso") return r.portal !== null && r.portal.ativo;
    if (filter === "sem_acesso") return r.portal === null;
    if (filter === "revogados") return r.portal !== null && !r.portal.ativo;
    return true;
  });

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
              <th className="px-4 py-3 text-left">Email do contato</th>
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
            {filtered.map((r) => (
              <tr key={r.client_id} className="border-b last:border-b-0 hover:bg-muted/20">
                <td className="px-4 py-3 font-medium">{r.client_nome}</td>
                <td className="px-4 py-3">
                  {r.portal === null ? (
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      Sem acesso
                    </span>
                  ) : r.portal.ativo ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-700 dark:text-emerald-300">
                      Ativo
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] text-destructive">
                      Revogado
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {r.portal?.email ?? "—"}
                  {r.portal?.nome_contato && (
                    <div className="text-[11px] text-muted-foreground/70">
                      {r.portal.nome_contato}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatDate(r.portal?.last_login_at ?? null)}
                </td>
                <td className="px-4 py-3 text-right">
                  {r.portal === null ? (
                    <Button
                      size="sm"
                      onClick={() => setConceder({ clientId: r.client_id, clientNome: r.client_nome })}
                    >
                      Conceder acesso
                    </Button>
                  ) : r.portal.ativo ? (
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setReset({ userId: r.portal!.user_id, clientNome: r.client_nome })
                        }
                      >
                        Resetar senha
                      </Button>
                      <RevogarAcessoButton
                        userId={r.portal.user_id}
                        clientNome={r.client_nome}
                      />
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => setConceder({ clientId: r.client_id, clientNome: r.client_nome })}
                    >
                      Conceder novo
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {conceder && (
        <ConcederAcessoDialog
          clientId={conceder.clientId}
          clientNome={conceder.clientNome}
          onClose={() => setConceder(null)}
        />
      )}
      {reset && (
        <ResetPasswordDialog
          userId={reset.userId}
          clientNome={reset.clientNome}
          onClose={() => setReset(null)}
        />
      )}
    </div>
  );
}
