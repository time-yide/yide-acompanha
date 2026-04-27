import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Row {
  id: string;
  nome: string;
  email: string;
  role: string;
  ativo: boolean;
  fixo_mensal: number;
  comissao_percent: number;
  comissao_primeiro_mes_percent: number;
}

const roleLabels: Record<string, string> = {
  adm: "ADM",
  socio: "Sócio",
  comercial: "Comercial",
  coordenador: "Coordenador",
  assessor: "Assessor",
};

export function ColaboradoresTable({ rows, canSeeFinance }: { rows: Row[]; canSeeFinance: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Papel</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Status</TableHead>
          {canSeeFinance && <TableHead className="text-right">Fixo</TableHead>}
          {canSeeFinance && <TableHead className="text-right">% Comissão</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id} className="cursor-pointer hover:bg-muted/40">
            <TableCell className="font-medium">
              <Link href={`/colaboradores/${r.id}`} className="hover:underline">
                {r.nome}
              </Link>
            </TableCell>
            <TableCell>
              <Badge variant="secondary">{roleLabels[r.role] ?? r.role}</Badge>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">{r.email}</TableCell>
            <TableCell>
              {r.ativo ? (
                <Badge variant="outline" className="border-green-500/40 text-green-600 dark:text-green-400">
                  Ativo
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  Inativo
                </Badge>
              )}
            </TableCell>
            {canSeeFinance && (
              <TableCell className="text-right tabular-nums">
                {Number(r.fixo_mensal).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </TableCell>
            )}
            {canSeeFinance && (
              <TableCell className="text-right tabular-nums">
                {r.role === "comercial" ? r.comissao_primeiro_mes_percent : r.comissao_percent}%
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
