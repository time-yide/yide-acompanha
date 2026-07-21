"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { AssignmentPopover } from "./AssignmentPopover";
import { BulkAssignmentBar } from "./BulkAssignmentBar";
import { StatusPopover } from "./StatusPopover";
import { ServicoPopover } from "./ServicoPopover";
import { MotivoChurnPopover } from "./MotivoChurnPopover";
import { ValorMensalPopover } from "./ValorMensalPopover";
import type { ClienteRow } from "@/lib/clientes/queries";

interface Option {
  id: string;
  nome: string;
}

interface Props {
  rows: ClienteRow[];
  canSeeMoney: boolean;
  assessores: Option[];
  coordenadores: Option[];
}

export function ClientesAssignmentTable({
  rows,
  canSeeMoney,
  assessores,
  coordenadores,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const nome = r.nome?.toLowerCase() ?? "";
      const servico = r.servico_contratado?.toLowerCase() ?? "";
      return nome.includes(q) || servico.includes(q);
    });
  }, [rows, query]);

  const visibleIds = useMemo(() => filteredRows.map((r) => r.id), [filteredRows]);
  const allSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someSelected = visibleIds.some((id) => selectedIds.has(id));
  const indeterminate = someSelected && !allSelected;

  function toggleAll(next: boolean) {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (next) {
        for (const id of visibleIds) newSet.add(id);
      } else {
        for (const id of visibleIds) newSet.delete(id);
      }
      return newSet;
    });
  }

  function toggleOne(id: string, next: boolean) {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (next) newSet.add(id);
      else newSet.delete(id);
      return newSet;
    });
  }

  return (
    <>
      <BulkAssignmentBar
        selectedIds={Array.from(selectedIds)}
        assessores={assessores}
        coordenadores={coordenadores}
        onClearSelection={() => setSelectedIds(new Set())}
      />
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por cliente ou serviço…"
          className="h-9 flex-1 min-w-[240px] rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <span className="text-xs text-muted-foreground">
          {filteredRows.length} {filteredRows.length === 1 ? "cliente" : "clientes"}
        </span>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                aria-label="Selecionar todos os clientes visíveis"
                checked={allSelected}
                indeterminate={indeterminate}
                onCheckedChange={(checked) => toggleAll(Boolean(checked))}
              />
            </TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Serviço</TableHead>
            <TableHead>Assessor</TableHead>
            <TableHead>Coordenador</TableHead>
            <TableHead>Motivo</TableHead>
            {canSeeMoney && (
              <TableHead className="text-right">Valor mensal</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredRows.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={canSeeMoney ? 8 : 7}
                className="py-8 text-center text-sm text-muted-foreground"
              >
                Nenhum cliente encontrado.
              </TableCell>
            </TableRow>
          )}
          {filteredRows.map((r) => {
            const isSelected = selectedIds.has(r.id);
            return (
              <TableRow
                key={r.id}
                className="hover:bg-muted/40"
                data-state={isSelected ? "selected" : undefined}
              >
                <TableCell className="w-10">
                  <Checkbox
                    aria-label={`Selecionar ${r.nome}`}
                    checked={isSelected}
                    onCheckedChange={(checked) =>
                      toggleOne(r.id, Boolean(checked))
                    }
                  />
                </TableCell>
                <TableCell className="font-medium">
                  <Link
                    href={`/clientes/${r.id}`}
                    className="hover:underline"
                  >
                    {r.nome}
                  </Link>
                </TableCell>
                <TableCell>
                  <StatusPopover clienteId={r.id} current={r.status} />
                </TableCell>
                <TableCell className="text-sm">
                  <ServicoPopover clienteId={r.id} current={r.servico_contratado} />
                </TableCell>
                <TableCell>
                  <AssignmentPopover
                    clienteId={r.id}
                    field="assessor"
                    currentName={r.assessor_nome ?? null}
                    currentId={r.assessor_id ?? null}
                    options={assessores}
                  />
                </TableCell>
                <TableCell>
                  <AssignmentPopover
                    clienteId={r.id}
                    field="coordenador"
                    currentName={r.coordenador_nome ?? null}
                    currentId={r.coordenador_id ?? null}
                    options={coordenadores}
                  />
                </TableCell>
                <TableCell className="text-sm">
                  {r.status === "churn" ? (
                    <MotivoChurnPopover
                      clienteId={r.id}
                      currentCategoria={r.motivo_churn_categoria ?? null}
                      currentDetalhe={r.motivo_churn ?? null}
                    />
                  ) : (
                    <span className="text-muted-foreground/40">—</span>
                  )}
                </TableCell>
                {canSeeMoney && (
                  <TableCell className="text-right">
                    <ValorMensalPopover
                      clienteId={r.id}
                      current={Number(r.valor_mensal)}
                      tipoRelacao={r.tipo_relacao ?? "comum"}
                    />
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </>
  );
}
