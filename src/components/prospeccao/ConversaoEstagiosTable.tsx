import type { FunnelStage } from "@/lib/dashboard/comercial-queries";

interface Props {
  data: FunnelStage[];
}

export function ConversaoEstagiosTable({ data }: Props) {
  const pairs: Array<{ from: string; to: string; pct: number }> = [];
  for (let i = 0; i < data.length - 1; i++) {
    const taxa = data[i].taxaConversaoAposEsta ?? 0;
    pairs.push({ from: data[i].label, to: data[i + 1].label, pct: taxa });
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b">
        <h3 className="text-sm font-semibold">Taxa de conversão entre estágios</h3>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-muted/30">
          <tr>
            <th className="px-3 py-2 text-left font-medium">De</th>
            <th className="px-3 py-2 text-left font-medium">Para</th>
            <th className="px-3 py-2 text-right font-medium">Conversão</th>
          </tr>
        </thead>
        <tbody>
          {pairs.map((p, i) => (
            <tr key={i} className="border-t">
              <td className="px-3 py-2">{p.from}</td>
              <td className="px-3 py-2">{p.to}</td>
              <td className="px-3 py-2 text-right tabular-nums font-semibold">{p.pct.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
