"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "./StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UnitBadge } from "@/components/units/UnitBadge";
import type { ClienteRow } from "@/lib/clientes/queries";
import type { Unit } from "@/lib/units/schema";

interface Props {
  rows: ClienteRow[];
  canSeeMoney: boolean;
  /** Quando passada, mostra coluna "Unidade" (multi-tenant, só pra master
   *  vendo consolidado). Se omitido ou só 1 unidade, coluna não aparece. */
  units?: Pick<Unit, "id" | "nome" | "cor_destaque">[];
}

export function ClientesTable({ rows, canSeeMoney, units }: Props) {
  const showUnit = !!units && units.length > 1;
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

  const colCount = 5 + (showUnit ? 1 : 0) + (canSeeMoney ? 1 : 0);

  return (
    <>
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
            <TableHead>Cliente</TableHead>
            {showUnit && <TableHead>Unidade</TableHead>}
            <TableHead>Status</TableHead>
            <TableHead>Serviço</TableHead>
            <TableHead>Assessor</TableHead>
            <TableHead>Coordenador</TableHead>
            {canSeeMoney && <TableHead className="text-right">Valor mensal</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredRows.length === 0 && (
            <TableRow>
              <TableCell colSpan={colCount} className="py-8 text-center text-sm text-muted-foreground">
                Nenhum cliente encontrado.
              </TableCell>
            </TableRow>
          )}
          {filteredRows.map((r) => (
            <TableRow key={r.id} className="hover:bg-muted/40">
              <TableCell className="font-medium">
                <Link href={`/clientes/${r.id}`} className="hover:underline">{r.nome}</Link>
              </TableCell>
              {showUnit && (
                <TableCell>
                  <UnitBadge unitId={r.unit_id} units={units!} />
                </TableCell>
              )}
              <TableCell><StatusBadge status={r.status} /></TableCell>
              <TableCell className="text-sm text-muted-foreground">{r.servico_contratado ?? ""}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{r.assessor_nome ?? ""}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{r.coordenador_nome ?? ""}</TableCell>
              {canSeeMoney && (
                <TableCell className="text-right tabular-nums">
                  {Number(r.valor_mensal).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
