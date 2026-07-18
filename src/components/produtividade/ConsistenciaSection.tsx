import { CalendarCheck } from "lucide-react";
import { pctRegularidade, type ConsistenciaRow } from "@/lib/produtividade/consistencia";

function corReg(pct: number | null): string {
  if (pct === null) return "text-muted-foreground";
  if (pct >= 80) return "text-emerald-500";
  if (pct >= 50) return "text-amber-500";
  return "text-rose-500";
}

export function ConsistenciaSection({ pessoas, diasUteis }: { pessoas: ConsistenciaRow[]; diasUteis: number }) {
  if (pessoas.length === 0 || diasUteis <= 1) return null;
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <CalendarCheck className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Consistência</h2>
      </div>

      <div className="overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Colaborador</th>
              <th className="px-3 py-2 text-right font-medium">Dias com entrega</th>
              <th className="px-4 py-2 text-right font-medium">Regularidade</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {pessoas.map((p) => {
              const pct = pctRegularidade(p.diasComEntrega, diasUteis);
              return (
                <tr key={p.user_id} className="hover:bg-muted/20">
                  <td className="truncate px-4 py-2.5 font-medium">{p.nome}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{p.diasComEntrega} / {diasUteis}</td>
                  <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${corReg(pct)}`}>
                    {pct === null ? "—" : `${pct}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground">
        Em quantos dias úteis do período a pessoa concluiu ao menos uma tarefa. Alto = entrega distribuída; baixo = trabalho concentrado/irregular.
      </p>
    </section>
  );
}
