import { listEntriesForClientWeek } from "@/lib/satisfacao/queries";
import type { SatisfactionColor } from "@/lib/satisfacao/schema";

interface Props {
  clientId: string;
  weekIso: string;
  scoreFinal: number;
  corFinal: SatisfactionColor;
  resumoIa: string;
  divergenciaDetectada: boolean;
  acaoSugerida: string | null;
}

const colorEmoji: Record<SatisfactionColor, string> = {
  verde: "🟢",
  amarelo: "🟡",
  vermelho: "🔴",
};

export async function WeeklySatisfactionDetail({
  clientId,
  weekIso,
  scoreFinal,
  corFinal,
  resumoIa,
  divergenciaDetectada,
  acaoSugerida,
}: Props) {
  const entries = await listEntriesForClientWeek(clientId, weekIso);

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span>Semana {weekIso}</span>
        <span>·</span>
        <span>{colorEmoji[corFinal]} {corFinal}</span>
        <span>·</span>
        <span className="tabular-nums">score {Number(scoreFinal).toFixed(1)}</span>
        {divergenciaDetectada && (
          <span className="ml-auto text-[11px] text-amber-600 dark:text-amber-400">⚠ divergência</span>
        )}
      </div>

      <div className="space-y-1.5 text-sm">
        {entries.filter((e) => e.cor !== null).map((e) => (
          <div key={e.id} className="text-muted-foreground">
            <span className="font-medium text-foreground">{e.papel_autor}:</span>{" "}
            {colorEmoji[e.cor!]}{" "}
            {e.comentario ?? <span className="italic">(sem comentário)</span>}
          </div>
        ))}
      </div>

      <div className="border-t pt-3 space-y-2 text-sm">
        <p>
          <span className="font-medium">Síntese IA:</span> {resumoIa}
        </p>
        {acaoSugerida && (
          <p>
            <span className="font-medium">Ação sugerida:</span> {acaoSugerida}
          </p>
        )}
      </div>
    </div>
  );
}
