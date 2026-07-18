import { Upload, Timer, AlertTriangle } from "lucide-react";
import type { EntregaMaterialUserRow } from "@/lib/produtividade/queries";
import { roleLabel } from "@/lib/auth/permissions";

interface Props {
  rows: EntregaMaterialUserRow[];
}

/** Duração humana: dias/horas/min. Usada pro turnaround de entrega. */
function formatDuracao(seg: number): string {
  if (seg < 60) return "<1min";
  const d = Math.floor(seg / 86400);
  const h = Math.floor((seg % 86400) / 3600);
  const m = Math.floor((seg % 3600) / 60);
  if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`;
  if (h > 0) return m > 0 ? `${h}h ${m}min` : `${h}h`;
  return `${m}min`;
}

function Valor({ seg }: { seg: number | null }) {
  if (seg === null) return <span className="text-muted-foreground/50">-</span>;
  return <span className="tabular-nums">{formatDuracao(seg)}</span>;
}

/**
 * "Tempo pra entregar" material de gravação, por pessoa: quanto levou entre o
 * FIM da gravação e subir o material no Drive. Só aparece pra quem teve
 * entrega ou pendência no período.
 */
export function EntregaMaterialSection({ rows }: Props) {
  if (rows.length === 0) return null;

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400">
          <Upload className="h-3.5 w-3.5" />
        </div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Tempo pra entregar material
        </h2>
      </div>
      <p className="mb-2 text-[11px] text-muted-foreground">
        Tempo entre o <strong className="text-foreground">fim da gravação</strong> e a pessoa{" "}
        <strong className="text-foreground">subir o material no Drive</strong>.
      </p>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left">Colaborador</th>
                <th className="px-4 py-2.5 text-right" title="Capturas entregues no período">
                  Entregues
                </th>
                <th className="px-4 py-2.5 text-right" title="Média do tempo entre gravação e subir o material">
                  <span className="inline-flex items-center gap-1">
                    <Timer className="h-3 w-3" /> Tempo médio
                  </span>
                </th>
                <th className="px-4 py-2.5 text-right" title="A captura que mais demorou pra subir no período">
                  Mais lenta
                </th>
                <th className="px-4 py-2.5 text-right" title="Gravou e ainda não subiu — relógio correndo desde a gravação">
                  Pendentes
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.user_id} className="border-b last:border-b-0 hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{r.nome}</div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {roleLabel(r.role)}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.entregues > 0 ? r.entregues : <span className="text-muted-foreground/50">-</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Valor seg={r.turnaround_medio_seg} />
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    <Valor seg={r.mais_lenta_seg} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.pendentes > 0 ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-700 dark:text-rose-300"
                        title={
                          r.pendente_mais_antiga_seg !== null
                            ? `Mais antiga há ${formatDuracao(r.pendente_mais_antiga_seg)}`
                            : undefined
                        }
                      >
                        <AlertTriangle className="h-3 w-3" />
                        {r.pendentes}
                        {r.pendente_mais_antiga_seg !== null && (
                          <span className="font-normal opacity-80">
                            · há {formatDuracao(r.pendente_mais_antiga_seg)}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
