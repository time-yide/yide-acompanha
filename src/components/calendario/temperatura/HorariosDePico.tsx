import { Card } from "@/components/ui/card";

const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function intensity(count: number, max: number): string {
  if (count === 0) return "bg-muted";
  const ratio = count / max;
  if (ratio > 0.66) return "bg-primary";
  if (ratio > 0.33) return "bg-primary/60";
  return "bg-primary/30";
}

/**
 * Mapa de calor hora-a-hora (dia × hora), adaptativo. `peakByHour` é 7×24
 * [dia][hora], já bucketizado no fuso da app. A faixa de horas renderizada é
 * a menor janela que cobre todos os eventos, com piso 8h–18h pra o grid não
 * ficar vazio num dia tranquilo.
 */
export function HorariosDePico({ peakByHour }: { peakByHour: number[][] }) {
  // Faixa ativa: menor e maior hora com algum evento (em qualquer dia).
  let minComEvento = 24;
  let maxComEvento = -1;
  for (let h = 0; h < 24; h++) {
    let temEvento = false;
    for (let d = 0; d < 7; d++) {
      if ((peakByHour[d]?.[h] ?? 0) > 0) {
        temEvento = true;
        break;
      }
    }
    if (temEvento) {
      if (h < minComEvento) minComEvento = h;
      if (h > maxComEvento) maxComEvento = h;
    }
  }

  // Clamp pra cobrir no mínimo 8h–18h; sem nenhum evento, usa 8..18.
  const startH = maxComEvento < 0 ? 8 : Math.min(8, minComEvento);
  const endH = maxComEvento < 0 ? 18 : Math.max(18, maxComEvento);
  const horas = Array.from({ length: endH - startH + 1 }, (_, i) => startH + i);

  const max = Math.max(1, ...peakByHour.flat());

  return (
    <Card className="space-y-3 p-4">
      <h3 className="text-sm font-semibold">Horários de pico</h3>
      <div className="grid grid-cols-[auto_repeat(7,1fr)] gap-1 text-[10px]">
        <div />
        {DIAS.map((d) => (
          <div key={d} className="text-center text-muted-foreground">
            {d}
          </div>
        ))}
        {horas.map((h) => (
          <HoraRow key={h} hora={h} peakByHour={peakByHour} max={max} />
        ))}
      </div>
    </Card>
  );
}

function HoraRow({ hora, peakByHour, max }: { hora: number; peakByHour: number[][]; max: number }) {
  const label = `${String(hora).padStart(2, "0")}h`;
  return (
    <>
      <div className="flex items-center pr-1 text-muted-foreground tabular-nums">{label}</div>
      {DIAS.map((dia, d) => {
        const count = peakByHour[d]?.[hora] ?? 0;
        return (
          <div
            key={d}
            className={`flex h-6 items-center justify-center rounded ${intensity(count, max)}`}
            title={`${dia} ${label}: ${count} evento(s)`}
          >
            {count > 0 ? count : ""}
          </div>
        );
      })}
    </>
  );
}
