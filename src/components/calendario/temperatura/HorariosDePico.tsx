import { Card } from "@/components/ui/card";

const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const FAIXAS = ["Manhã", "Tarde", "Noite"];

function intensity(count: number, max: number): string {
  if (count === 0) return "bg-muted";
  const ratio = count / max;
  if (ratio > 0.66) return "bg-primary";
  if (ratio > 0.33) return "bg-primary/60";
  return "bg-primary/30";
}

export function HorariosDePico({ peak }: { peak: number[][] }) {
  const max = Math.max(1, ...peak.flat());
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
        {FAIXAS.map((faixa, f) => (
          <FaixaRow key={faixa} faixa={faixa} f={f} peak={peak} max={max} />
        ))}
      </div>
    </Card>
  );
}

function FaixaRow({ faixa, f, peak, max }: { faixa: string; f: number; peak: number[][]; max: number }) {
  return (
    <>
      <div className="flex items-center text-muted-foreground">{faixa}</div>
      {peak.map((dia, d) => (
        <div
          key={d}
          className={`flex h-7 items-center justify-center rounded ${intensity(dia[f], max)}`}
          title={`${faixa}: ${dia[f]} evento(s)`}
        >
          {dia[f] > 0 ? dia[f] : ""}
        </div>
      ))}
    </>
  );
}
