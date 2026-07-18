import { Card } from "@/components/ui/card";
import type { OportunidadeRow } from "@/lib/freela-yide/queries";

const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR")}`;

/** Totais em R$ das oportunidades lançadas (equipe): total, concluído (fechadas)
 * e em andamento (disponível/pega/em negociação). Cancelados ficam de fora do
 * total (não viram faturamento). */
export function ResumoSubidos({ ops }: { ops: OportunidadeRow[] }) {
  if (ops.length === 0) return null;

  const soma = (fn: (o: OportunidadeRow) => boolean) =>
    ops.filter(fn).reduce((s, o) => s + o.valor_comissao, 0);
  const conta = (fn: (o: OportunidadeRow) => boolean) => ops.filter(fn).length;

  const concluido = soma((o) => o.status === "fechada");
  const emAndamento = soma((o) => o.status === "disponivel" || o.status === "pega" || o.status === "em_negociacao");
  const cancelado = soma((o) => o.status === "perdida");
  const total = concluido + emAndamento;

  const nConcluido = conta((o) => o.status === "fechada");
  const nAndamento = conta((o) => o.status === "disponivel" || o.status === "pega" || o.status === "em_negociacao");

  return (
    <Card className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
      <div>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Total lançado</p>
        <p className="text-xl font-bold tabular-nums text-fuchsia-400">{fmt(total)}</p>
        <p className="text-[11px] text-muted-foreground">{nConcluido + nAndamento} freela(s)</p>
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Concluído</p>
        <p className="text-xl font-bold tabular-nums text-emerald-400">{fmt(concluido)}</p>
        <p className="text-[11px] text-muted-foreground">{nConcluido} fechada(s)</p>
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Em andamento</p>
        <p className="text-xl font-bold tabular-nums text-cyan-400">{fmt(emAndamento)}</p>
        <p className="text-[11px] text-muted-foreground">{nAndamento} em aberto</p>
      </div>
      {cancelado > 0 && (
        <p className="col-span-2 text-[11px] text-muted-foreground sm:col-span-3">
          Cancelados (fora do total): {fmt(cancelado)}
        </p>
      )}
    </Card>
  );
}
