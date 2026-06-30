import Link from "next/link";
import type { ProspectListRow } from "@/lib/prospeccao/queries";
import { LigarProspectButton } from "./LigarProspectButton";

interface Props {
  rows: ProspectListRow[];
}

function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

const STAGE_LABEL: Record<string, string> = {
  leads_potencial: "Leads em potencial",
  leads_ativos: "Leads ativos",
  proposta_enviada: "Proposta enviada",
  reuniao_comercial: "Reunião comercial",
  contrato: "Contrato",
  marco_zero: "Marco zero",
  ativo: "Ativo",
  // Legados
  prospeccao: "Leads ativos",
  comercial: "Reunião comercial",
};

const STAGE_BADGE: Record<string, string> = {
  leads_potencial: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  leads_ativos: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  proposta_enviada: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  reuniao_comercial: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  contrato: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  marco_zero: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  ativo: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  // Legados
  prospeccao: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  comercial: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
};

export function ProspectsTable({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
        Nenhum prospect encontrado com os filtros atuais.
      </p>
    );
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Prospect</th>
            <th className="px-3 py-2 text-left font-medium">Stage</th>
            <th className="px-3 py-2 text-right font-medium">Valor</th>
            <th className="px-3 py-2 text-left font-medium">Comercial</th>
            <th className="px-3 py-2 text-left font-medium">Criado</th>
            <th className="px-3 py-2 text-right font-medium">Ligar</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t hover:bg-muted/30">
              <td className="px-3 py-2">
                <Link href={`/prospeccao/prospects/${r.id}`} className="font-medium hover:underline">
                  {r.nome_prospect}
                </Link>
                {r.site && <div className="text-xs text-muted-foreground truncate">{r.site}</div>}
              </td>
              <td className="px-3 py-2">
                {r.motivo_perdido ? (
                  <span className="inline-block rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-[11px] text-red-700 dark:text-red-300">
                    Perdido
                  </span>
                ) : (
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] ${STAGE_BADGE[r.stage]}`}>
                    {STAGE_LABEL[r.stage]}
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{formatBRL(Number(r.valor_proposto))}</td>
              <td className="px-3 py-2 text-muted-foreground">{r.comercial?.nome ?? ""}</td>
              <td className="px-3 py-2 text-muted-foreground text-xs">
                {new Date(r.created_at).toLocaleDateString("pt-BR")}
              </td>
              <td className="px-3 py-2 text-right">
                {r.telefone ? (
                  <LigarProspectButton
                    leadId={r.id}
                    numero={r.telefone}
                    contatoNome={r.contato_principal ?? r.nome_prospect}
                  />
                ) : (
                  <span className="text-[10px] text-muted-foreground">sem telefone</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
