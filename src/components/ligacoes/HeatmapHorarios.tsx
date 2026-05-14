import { Card } from "@/components/ui/card";
import type { HeatmapCell } from "@/lib/ligacoes/queries";

interface Props {
  cells: HeatmapCell[];
}

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function HeatmapHorarios({ cells }: Props) {
  const maxCount = Math.max(1, ...cells.map((c) => c.count));

  // Reagrupa em matriz 7×24
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const c of cells) {
    grid[c.diaSemana][c.hora] = c.count;
  }

  function getColor(count: number): string {
    if (count === 0) return "bg-muted/30";
    const intensity = count / maxCount;
    if (intensity < 0.2) return "bg-primary/15";
    if (intensity < 0.4) return "bg-primary/30";
    if (intensity < 0.6) return "bg-primary/50";
    if (intensity < 0.8) return "bg-primary/70";
    return "bg-primary";
  }

  // Mostra label de hora em colunas pares
  const horas = Array.from({ length: 24 }, (_, h) => h);

  return (
    <Card className="p-5 space-y-3">
      <div>
        <h2 className="font-semibold text-sm">Mapa de calor · horários</h2>
        <p className="text-[11px] text-muted-foreground">
          Volume de chamadas por dia da semana × hora (BRT)
        </p>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Header de horas */}
          <div className="flex pl-10 mb-1">
            {horas.map((h) => (
              <div key={h} className="flex-1 text-center text-[9px] text-muted-foreground tabular-nums">
                {h % 2 === 0 ? `${String(h).padStart(2, "0")}` : ""}
              </div>
            ))}
          </div>

          {/* Linhas dos dias */}
          {DIAS.map((dia, diaIdx) => (
            <div key={dia} className="flex items-center mb-0.5">
              <div className="w-10 text-[10px] text-muted-foreground font-medium">{dia}</div>
              {horas.map((h) => {
                const count = grid[diaIdx][h];
                return (
                  <div
                    key={h}
                    className={`flex-1 aspect-square min-w-[12px] max-w-[28px] m-px rounded-sm transition-colors hover:ring-2 hover:ring-primary/50 ${getColor(count)}`}
                    title={`${dia} ${String(h).padStart(2, "0")}:00 → ${count} chamada${count === 1 ? "" : "s"}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 text-[10px] text-muted-foreground">
        <span>menos</span>
        <div className="flex gap-0.5">
          <div className="h-3 w-3 rounded-sm bg-muted/30" />
          <div className="h-3 w-3 rounded-sm bg-primary/15" />
          <div className="h-3 w-3 rounded-sm bg-primary/30" />
          <div className="h-3 w-3 rounded-sm bg-primary/50" />
          <div className="h-3 w-3 rounded-sm bg-primary/70" />
          <div className="h-3 w-3 rounded-sm bg-primary" />
        </div>
        <span>mais</span>
      </div>
    </Card>
  );
}
