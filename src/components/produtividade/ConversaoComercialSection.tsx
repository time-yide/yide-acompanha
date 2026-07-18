import { PhoneCall } from "lucide-react";
import { taxaConversao, type ConversaoRow } from "@/lib/produtividade/conversao-comercial";

function corTaxa(pct: number | null): string {
  if (pct === null) return "text-muted-foreground";
  if (pct >= 30) return "text-emerald-500";
  if (pct >= 15) return "text-amber-500";
  return "text-rose-500";
}

export function ConversaoComercialSection({ pessoas }: { pessoas: ConversaoRow[] }) {
  if (pessoas.length === 0) return null;
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <PhoneCall className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Conversão comercial</h2>
      </div>

      <div className="overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Assessor</th>
              <th className="px-3 py-2 text-right font-medium">Ligações</th>
              <th className="px-3 py-2 text-right font-medium">Leads</th>
              <th className="px-4 py-2 text-right font-medium">Conversão</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {pessoas.map((p) => {
              const taxa = taxaConversao(p.leads, p.ligacoes);
              return (
                <tr key={p.user_id} className="hover:bg-muted/20">
                  <td className="truncate px-4 py-2.5 font-medium">{p.nome}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{p.ligacoes}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{p.leads}</td>
                  <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${corTaxa(taxa)}`}>
                    {taxa === null ? "—" : `${taxa}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground">
        Conversão = ligações de saída que geraram lead ÷ total de ligações. Mede resultado, não só volume.
      </p>
    </section>
  );
}
