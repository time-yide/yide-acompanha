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
import { StatusBadge } from "./StatusBadge";
import { AssignmentPopover } from "./AssignmentPopover";
import { BulkAssignmentBar } from "./BulkAssignmentBar";
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

  const visibleIds = useMemo(() => rows.map((r) => r.id), [rows]);
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
            {canSeeMoney && (
              <TableHead className="text-right">Valor mensal</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
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
                  <StatusBadge status={r.status} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {r.servico_contratado ?? "—"}
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
                {canSeeMoney && (
                  <TableCell className="text-right tabular-nums">
                    {Number(r.valor_mensal).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
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
