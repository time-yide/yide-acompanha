import { faixaNota } from "@/lib/dados/nota";
import { cn } from "@/lib/utils";

const COR = { risco: "text-rose-300", atencao: "text-amber-300", bom: "text-emerald-300", sem_dados: "text-white/40" };
const BARRA = { risco: "bg-rose-400", atencao: "bg-amber-400", bom: "bg-emerald-400", sem_dados: "bg-white/20" };

export function NotaBarra({ nota, anterior }: { nota: number | null; anterior: number | null }) {
  const f = faixaNota(nota);
  const delta = nota != null && anterior != null ? nota - anterior : null;
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between text-sm">
        <span className={cn("font-semibold tabular-nums", COR[f])}>{nota ?? "—"}</span>
        {delta != null && (
          <span className={cn("text-xs tabular-nums", delta > 0 ? "text-emerald-300" : delta < 0 ? "text-rose-300" : "text-white/40")}>
            {delta > 0 ? `+${delta}` : delta}
          </span>
        )}
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className={cn("h-full rounded-full", BARRA[f])} style={{ width: `${nota ?? 0}%` }} />
      </div>
    </div>
  );
}
