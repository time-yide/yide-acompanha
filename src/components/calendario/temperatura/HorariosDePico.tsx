import { Card } from "@/components/ui/card";
import { Flame, Coffee, Clock, Target } from "lucide-react";

const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const DIAS_FULL = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

const fmtHora = (h: number) => `${String(h).padStart(2, "0")}h`;

/** Insights do heatmap (7×24): dia mais cheio, dia útil mais tranquilo, horário
 *  de pico e o slot (dia+hora) mais lotado. `null` quando não há eventos. */
function analisarPico(peakByHour: number[][]) {
  const byDay = Array.from({ length: 7 }, (_, d) =>
    Array.from({ length: 24 }, (_, h) => peakByHour[d]?.[h] ?? 0).reduce((s, n) => s + n, 0),
  );
  const byHour = Array.from({ length: 24 }, (_, h) =>
    Array.from({ length: 7 }, (_, d) => peakByHour[d]?.[h] ?? 0).reduce((s, n) => s + n, 0),
  );
  const total = byDay.reduce((s, n) => s + n, 0);
  if (total === 0) return null;

  let diaMax = 0;
  for (let d = 1; d < 7; d++) if (byDay[d] > byDay[diaMax]) diaMax = d;
  // Dia útil mais tranquilo (Seg–Sex); fim de semana quase sempre vazio não conta.
  let diaUtilMin = 0;
  for (let d = 1; d < 5; d++) if (byDay[d] < byDay[diaUtilMin]) diaUtilMin = d;
  let horaMax = 0;
  for (let h = 1; h < 24; h++) if (byHour[h] > byHour[horaMax]) horaMax = h;
  let sd = 0, sh = 0, sv = -1;
  for (let d = 0; d < 7; d++)
    for (let h = 0; h < 24; h++) {
      const v = peakByHour[d]?.[h] ?? 0;
      if (v > sv) { sv = v; sd = d; sh = h; }
    }

  return {
    total,
    diaMaisCheio: { nome: DIAS_FULL[diaMax], count: byDay[diaMax] },
    diaMaisTranquilo: { nome: DIAS_FULL[diaUtilMin], count: byDay[diaUtilMin] },
    horaPico: { hora: horaMax, count: byHour[horaMax] },
    slotPico: { nome: DIAS_FULL[sd], hora: sh, count: sv },
  };
}

function Insight({ icon: Icon, label, valor, detalhe }: { icon: typeof Flame; label: string; valor: string; detalhe: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg bg-muted/40 p-2.5">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-semibold">{valor}</p>
        <p className="truncate text-[11px] text-muted-foreground">{detalhe}</p>
      </div>
    </div>
  );
}

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
  const analise = analisarPico(peakByHour);

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

      {/* Análise automática do mapa de calor. */}
      {analise && (
        <div className="mt-1 border-t pt-3">
          <p className="mb-2 text-[11px] font-semibold text-muted-foreground">
            Análise · {analise.total} evento{analise.total === 1 ? "" : "s"} no período
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Insight
              icon={Flame}
              label="Dia mais cheio"
              valor={analise.diaMaisCheio.nome}
              detalhe={`${analise.diaMaisCheio.count} evento${analise.diaMaisCheio.count === 1 ? "" : "s"} no total`}
            />
            <Insight
              icon={Coffee}
              label="Dia mais tranquilo (útil)"
              valor={analise.diaMaisTranquilo.nome}
              detalhe={
                analise.diaMaisTranquilo.count === 0
                  ? "sem eventos"
                  : `${analise.diaMaisTranquilo.count} evento${analise.diaMaisTranquilo.count === 1 ? "" : "s"}`
              }
            />
            <Insight
              icon={Clock}
              label="Horário de pico"
              valor={fmtHora(analise.horaPico.hora)}
              detalhe={`${analise.horaPico.count} evento${analise.horaPico.count === 1 ? "" : "s"} nesse horário`}
            />
            <Insight
              icon={Target}
              label="Momento mais lotado"
              valor={`${analise.slotPico.nome} · ${fmtHora(analise.slotPico.hora)}`}
              detalhe={`${analise.slotPico.count} evento${analise.slotPico.count === 1 ? "" : "s"} de uma vez`}
            />
          </div>
        </div>
      )}
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
