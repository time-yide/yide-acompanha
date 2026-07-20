import { Card } from "@/components/ui/card";
import type { PersonLoad } from "@/lib/calendario/temperatura";

export function CargaPorPessoa({ byPerson, nomes }: { byPerson: PersonLoad[]; nomes: Record<string, string> }) {
  const maxCount = Math.max(1, ...byPerson.map((p) => p.count));
  return (
    <Card className="space-y-3 p-4">
      <h3 className="text-sm font-semibold">Carga por pessoa</h3>
      {byPerson.length === 0 ? (
        <p className="text-xs text-muted-foreground">Ninguém do time tem eventos nesta semana.</p>
      ) : (
        <div className="space-y-1.5">
          {byPerson.map((p) => {
            const horas = Math.round((p.minutes / 60) * 10) / 10;
            const overloaded = p.count >= maxCount && maxCount > 1;
            return (
              <div key={p.userId} className="flex items-center gap-2 text-xs">
                <span className="w-28 truncate text-muted-foreground">{nomes[p.userId] ?? "—"}</span>
                <div className="h-4 flex-1 overflow-hidden rounded bg-muted">
                  <div
                    className={overloaded ? "h-full rounded bg-destructive" : "h-full rounded bg-primary"}
                    style={{ width: `${(p.count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="w-20 text-right tabular-nums">
                  {p.count} ev · {horas}h
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
