import { CANAL_LABEL, type Perda } from "@/lib/dados/tipos";

export function PerdasLista({ perdas }: { perdas: Perda[] }) {
  if (perdas.length === 0) return <p className="text-sm text-emerald-300">Nenhuma perda nos canais que conseguimos ler.</p>;
  return (
    <ul className="space-y-2">
      {perdas.map((p, i) => (
        <li key={i} className="flex items-start gap-3 text-sm">
          <span className={p.gravidade === "alta"
            ? "rounded bg-rose-500/15 px-2 py-0.5 text-xs font-medium text-rose-300"
            : "rounded bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-300"}>
            {p.gravidade === "alta" ? "Alto" : "Médio"}
          </span>
          <span><span className="text-white/50">{CANAL_LABEL[p.canal]}:</span> {p.texto}</span>
        </li>
      ))}
    </ul>
  );
}
