"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddClienteDialog } from "./AddClienteDialog";
import type { ClienteOnboardingResumo } from "@/lib/d0-d30/queries";

type Filter = "todos" | "atrasados" | "atencao" | "ok" | "concluidos";

interface Props {
  resumos: ClienteOnboardingResumo[];
  canManage: boolean;
  elegiveis: Array<{ id: string; nome: string; data_entrada: string }>;
}

const STATUS_BADGE: Record<ClienteOnboardingResumo["status_visao_geral"], { label: string; cls: string }> = {
  atrasado: { label: "🔴 Atrasado", cls: "bg-red-500/15 text-red-700 dark:text-red-300" },
  atencao: { label: "🟡 Atenção", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  ok: { label: "🟢 No prazo", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  concluido: { label: "✅ Concluído", cls: "bg-muted text-muted-foreground" },
};

export function D0D30Table({ resumos, canManage, elegiveis }: Props) {
  const [filter, setFilter] = useState<Filter>("todos");
  const [addOpen, setAddOpen] = useState(false);

  const filtered = resumos.filter((r) => {
    if (filter === "atrasados") return r.status_visao_geral === "atrasado";
    if (filter === "atencao") return r.status_visao_geral === "atencao";
    if (filter === "ok") return r.status_visao_geral === "ok";
    if (filter === "concluidos") return r.status_visao_geral === "concluido";
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {(["todos", "atrasados", "atencao", "ok", "concluidos"] as Filter[]).map((f, i) => (
            <span key={f} className="flex items-center gap-2">
              {i > 0 && <span className="text-muted-foreground">·</span>}
              <button
                type="button"
                onClick={() => setFilter(f)}
                className={
                  filter === f
                    ? "font-semibold text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }
              >
                {f === "todos"
                  ? "Todos"
                  : f === "atrasados"
                  ? "Atrasados"
                  : f === "atencao"
                  ? "Atenção"
                  : f === "ok"
                  ? "No prazo"
                  : "Concluídos"}
              </button>
            </span>
          ))}
        </div>

        {canManage && (
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Adicionar cliente
          </Button>
        )}
      </div>

      <div className="rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Cliente</th>
              <th className="px-4 py-3 text-left">Dia hoje</th>
              <th className="px-4 py-3 text-left">Etapa atual</th>
              <th className="px-4 py-3 text-left">Progresso</th>
              <th className="px-4 py-3 text-left">Responsável</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  Nenhum cliente neste filtro.
                </td>
              </tr>
            )}
            {filtered.map((r) => {
              const status = STATUS_BADGE[r.status_visao_geral];
              const pctItens =
                r.total_itens_periodo > 0
                  ? Math.round((r.concluidos_itens_periodo / r.total_itens_periodo) * 100)
                  : 0;
              const diaLabel = r.dia_atual < 0 ? `${r.dia_atual}` : `D${r.dia_atual}`;
              return (
                <tr
                  key={r.client_id}
                  className="border-b last:border-b-0 hover:bg-muted/20"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/d0-d30/${r.client_id}`}
                      className="font-medium hover:text-primary hover:underline"
                    >
                      {r.client_nome}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums text-muted-foreground">
                    {diaLabel}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.etapa_atual ? (
                      <span>
                        <span className="text-foreground">{r.etapa_atual.numero}.</span>{" "}
                        {r.etapa_atual.nome}
                      </span>
                    ) : (
                      <span className="italic">Todas concluídas</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full transition-all ${
                            r.status_visao_geral === "concluido"
                              ? "bg-emerald-500"
                              : "bg-primary"
                          }`}
                          style={{ width: `${pctItens}%` }}
                        />
                      </div>
                      <span className="text-[11px] tabular-nums text-muted-foreground">
                        {r.concluidos_itens_periodo}/{r.total_itens_periodo}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {[r.assessor_nome, r.coordenador_nome].filter(Boolean).join(" · ") ||
                      <span className="italic">Sem atribuição</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${status.cls}`}
                    >
                      {status.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {addOpen && (
        <AddClienteDialog elegiveis={elegiveis} onClose={() => setAddOpen(false)} />
      )}
    </div>
  );
}
