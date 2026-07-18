import { CalendarClock, Timer, Gauge } from "lucide-react";
import { pctPrazo, type PrazoAgilidadeRow, type ResumoPrazoAgilidade } from "@/lib/produtividade/prazo-agilidade";

function corPct(pct: number | null): string {
  if (pct === null) return "text-muted-foreground";
  if (pct >= 80) return "text-emerald-500";
  if (pct >= 50) return "text-amber-500";
  return "text-rose-500";
}

function fmtLead(dias: number | null): string {
  if (dias === null) return "—";
  if (dias < 1) return `${Math.round(dias * 24)}h`;
  return `${dias.toFixed(1)}d`;
}

function StatCard({ icon: Icon, label, value, cor }: { icon: typeof Timer; label: string; value: string; cor?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className={`mt-1 text-2xl font-extrabold tabular-nums ${cor ?? ""}`}>{value}</p>
    </div>
  );
}

export function PrazoAgilidadeSection({ pessoas, resumo }: { pessoas: PrazoAgilidadeRow[]; resumo: ResumoPrazoAgilidade }) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Prazo &amp; agilidade das tarefas</h2>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard icon={Gauge} label="No prazo (time)" value={resumo.pct === null ? "—" : `${resumo.pct}%`} cor={corPct(resumo.pct)} />
        <StatCard icon={Timer} label="Tempo médio de entrega" value={fmtLead(resumo.leadTimeMedioDias)} />
        <StatCard icon={CalendarClock} label="Tarefas concluídas" value={resumo.entregues.toLocaleString("pt-BR")} />
      </div>

      {pessoas.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-10 text-center text-sm text-muted-foreground">
          Nenhuma tarefa concluída no período.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Colaborador</th>
                <th className="px-3 py-2 text-right font-medium">Concluídas</th>
                <th className="px-3 py-2 text-right font-medium">No prazo</th>
                <th className="px-4 py-2 text-right font-medium">Tempo médio</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pessoas.map((p) => {
                const pct = pctPrazo(p.no_prazo, p.com_prazo);
                return (
                  <tr key={p.user_id} className="hover:bg-muted/20">
                    <td className="truncate px-4 py-2.5 font-medium">{p.nome}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{p.entregues}</td>
                    <td className={`px-3 py-2.5 text-right font-semibold tabular-nums ${corPct(pct)}`}>
                      {pct === null ? "—" : `${pct}%`}
                      {p.com_prazo > 0 && <span className="ml-1 text-[10px] font-normal text-muted-foreground">({p.no_prazo}/{p.com_prazo})</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{fmtLead(p.leadTimeMedioDias)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-1.5 text-[10px] text-muted-foreground">
        No prazo = tarefas concluídas até o prazo (só as que têm prazo contam). Tempo médio = da criação à conclusão.
      </p>
    </section>
  );
}
