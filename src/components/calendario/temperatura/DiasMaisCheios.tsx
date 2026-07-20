import { Card } from "@/components/ui/card";

const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export function DiasMaisCheios({ byWeekday }: { byWeekday: number[] }) {
  const max = Math.max(1, ...byWeekday);
  return (
    <Card className="space-y-3 p-4">
      <h3 className="text-sm font-semibold">Dias mais cheios</h3>
      <div className="space-y-1.5">
        {byWeekday.map((count, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-8 text-muted-foreground">{DIAS[i]}</span>
            <div className="h-4 flex-1 overflow-hidden rounded bg-muted">
              <div className="h-full rounded bg-primary" style={{ width: `${(count / max) * 100}%` }} />
            </div>
            <span className="w-6 text-right tabular-nums">{count}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
