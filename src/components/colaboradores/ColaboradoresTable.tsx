import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RowActionsMenu } from "@/components/colaboradores/RowActionsMenu";

interface Row {
  id: string;
  nome: string;
  email: string;
  role: string;
  ativo: boolean;
  fixo_mensal: number;
  comissao_percent: number;
  comissao_primeiro_mes_percent: number;
  data_admissao: string | null;
  avatar_url: string | null;
}

const roleLabels: Record<string, string> = {
  adm: "ADM",
  socio: "Sócio",
  comercial: "Comercial",
  coordenador: "Coordenador",
  assessor: "Assessor",
  videomaker: "Videomaker",
  designer: "Designer",
  editor: "Editor",
  audiovisual_chefe: "Audiovisual Chefe",
};

const PRODUCERS = new Set(["videomaker", "designer", "editor"]);

function initials(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function Avatar({ url, nome }: { url: string | null; nome: string }) {
  if (url) {
    return (
      <Image
        src={url}
        alt={nome}
        width={32}
        height={32}
        className="h-8 w-8 rounded-full object-cover"
        unoptimized
      />
    );
  }
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
      {initials(nome)}
    </div>
  );
}

function commissionLabel(role: string, comissao: number, comissao1Mes: number): string {
  if (PRODUCERS.has(role)) return "—";
  if (role === "comercial") return `${comissao1Mes}%`;
  return `${comissao}%`;
}

export function ColaboradoresTable({
  rows,
  canSeeFinance,
  canEdit,
  canArchive,
  currentUserId,
}: {
  rows: Row[];
  canSeeFinance: boolean;
  canEdit: boolean;
  canArchive: boolean;
  currentUserId: string;
}) {
  const showActionsCol = canEdit || canArchive;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12"></TableHead>
          <TableHead>Nome</TableHead>
          <TableHead>Papel</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Admissão</TableHead>
          <TableHead>Status</TableHead>
          {canSeeFinance && <TableHead className="text-right">Fixo</TableHead>}
          {canSeeFinance && <TableHead className="text-right">% Comissão</TableHead>}
          {showActionsCol && <TableHead className="w-12" aria-label="Ações"></TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id} className="hover:bg-muted/40">
            <TableCell>
              <Avatar url={r.avatar_url} nome={r.nome} />
            </TableCell>
            <TableCell className="font-medium">
              <Link href={`/colaboradores/${r.id}`} className="hover:underline">
                {r.nome}
              </Link>
            </TableCell>
            <TableCell>
              <Badge variant="secondary">{roleLabels[r.role] ?? r.role}</Badge>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">{r.email}</TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {r.data_admissao ? new Date(r.data_admissao).toLocaleDateString("pt-BR") : "—"}
            </TableCell>
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
                {Number(r.fixo_mensal).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </TableCell>
            )}
            {canSeeFinance && (
              <TableCell className="text-right tabular-nums">
                {commissionLabel(r.role, Number(r.comissao_percent), Number(r.comissao_primeiro_mes_percent))}
              </TableCell>
            )}
            {showActionsCol && (
              <TableCell className="text-right">
                <RowActionsMenu
                  userId={r.id}
                  userNome={r.nome}
                  ativo={r.ativo}
                  canEdit={canEdit}
                  canArchive={canArchive}
                  isSelf={r.id === currentUserId}
                />
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
