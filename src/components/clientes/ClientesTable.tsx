import Link from "next/link";
import { StatusBadge } from "./StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ClienteRow } from "@/lib/clientes/queries";

export function ClientesTable({ rows, canSeeMoney }: { rows: ClienteRow[]; canSeeMoney: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Cliente</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Serviço</TableHead>
          <TableHead>Assessor</TableHead>
          <TableHead>Coordenador</TableHead>
          {canSeeMoney && <TableHead className="text-right">Valor mensal</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id} className="hover:bg-muted/40">
            <TableCell className="font-medium">
              <Link href={`/clientes/${r.id}`} className="hover:underline">{r.nome}</Link>
            </TableCell>
            <TableCell><StatusBadge status={r.status} /></TableCell>
            <TableCell className="text-sm text-muted-foreground">{r.servico_contratado ?? "—"}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{r.assessor_nome ?? "—"}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{r.coordenador_nome ?? "—"}</TableCell>
            {canSeeMoney && (
              <TableCell className="text-right tabular-nums">
                {Number(r.valor_mensal).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
