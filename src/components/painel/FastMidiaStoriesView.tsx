import Link from "next/link";
import { StoriesCell } from "./cells/StoriesCell";
import { cn } from "@/lib/utils";
import type { StoriesRow } from "@/lib/painel/stories-queries";

interface Props {
  mesAtual: string;
  mesesDisponiveis: string[];
  rows: StoriesRow[];
  canEdit: boolean;
}

function formatMonthLabel(monthRef: string): string {
  const [y, m] = monthRef.split("-");
  const names = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${names[Number(m) - 1]}/${y.slice(2)}`;
}

export function FastMidiaStoriesView({ mesAtual, mesesDisponiveis, rows, canEdit }: Props) {
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stories</h1>
          <p className="text-sm text-muted-foreground">Contagem mensal de stories por cliente</p>
        </div>
        {/* Nav de mês por links ?mes= (server component, sem JS). */}
        <div className="flex flex-wrap gap-1.5">
          {mesesDisponiveis.map((m) => (
            <Link
              key={m}
              href={`/painel?mes=${m}`}
              className={cn(
                "rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
                m === mesAtual
                  ? "border-foreground/30 bg-foreground/5"
                  : "border-muted-foreground/20 bg-muted/40 text-muted-foreground hover:bg-muted",
              )}
            >
              {formatMonthLabel(m)}
            </Link>
          ))}
        </div>
      </header>

      {rows.length === 0 ? (
        <p className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          Nenhum cliente com stories ativado.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Cliente</th>
                <th className="px-2 py-2 text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Stories (postados / meta)
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.client_id} className="border-t">
                  <td className="px-3 py-2 align-top">
                    <div className="font-medium">{row.client_nome}</div>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {row.quantidade_diaria_stories}/dia
                    </p>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <StoriesCell
                      clientId={row.client_id}
                      clientNome={row.client_nome}
                      mesReferencia={mesAtual}
                      postados={row.postados}
                      meta={row.meta}
                      canEdit={canEdit}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
