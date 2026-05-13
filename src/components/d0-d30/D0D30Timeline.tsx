import { formatEtapaRangeDates } from "@/lib/d0-d30/template";
import type { EtapaRow } from "@/lib/d0-d30/queries";

interface Props {
  etapas: EtapaRow[];
  diaAtual: number;
}

const ETAPA_NOMES: Record<string, string> = {
  entrada: "Entrada",
  cadastro: "Cadastro",
  marco_zero: "Marco zero",
  trafego: "Tráfego",
  producao: "Produção",
  apresentacao: "Apresentação",
  publicacao: "Publicação",
};

/**
 * Timeline visual horizontal das etapas 1-7 (D0 → D30).
 * Cada etapa é um marco com cor por status:
 *  - verde: concluída
 *  - azul (primary): em progresso
 *  - amber: deveria estar acontecendo mas pendente
 *  - red: atrasada (já passou do dia_fim)
 *  - cinza: futura
 */
export function D0D30Timeline({ etapas, diaAtual }: Props) {
  const sorted = [...etapas].sort((a, b) => a.etapa_numero - b.etapa_numero);

  function statusOf(e: EtapaRow): "concluido" | "em_progresso" | "atrasado" | "atencao" | "futura" {
    if (e.status === "concluido") return "concluido";
    if (e.status === "em_progresso") return "em_progresso";
    if (e.dia_fim_previsto !== null && diaAtual > e.dia_fim_previsto) return "atrasado";
    if (e.dia_inicio_previsto !== null && diaAtual >= e.dia_inicio_previsto) return "atencao";
    return "futura";
  }

  const dotStyle = {
    concluido: "bg-emerald-500 ring-emerald-500/30",
    em_progresso: "bg-primary ring-primary/30",
    atrasado: "bg-red-500 ring-red-500/30",
    atencao: "bg-amber-500 ring-amber-500/30",
    futura: "bg-muted-foreground/30 ring-muted-foreground/10",
  } as const;

  return (
    <div className="overflow-x-auto rounded-xl border bg-card p-4 sm:p-6">
      <div className="relative flex min-w-[680px] items-start justify-between gap-2">
        {/* Linha de fundo */}
        <div className="absolute left-4 right-4 top-3 h-0.5 bg-muted" />

        {sorted.map((e) => {
          const st = statusOf(e);
          const diaLabel =
            e.dia_inicio_previsto === e.dia_fim_previsto
              ? `D${e.dia_inicio_previsto}`
              : `D${e.dia_inicio_previsto}–D${e.dia_fim_previsto}`;
          return (
            <div key={e.id} className="relative flex flex-1 flex-col items-center gap-1.5">
              <div
                className={`relative z-10 h-6 w-6 rounded-full ring-4 ${dotStyle[st]} flex items-center justify-center`}
              >
                {st === "concluido" && (
                  <span className="text-[10px] font-bold text-white">✓</span>
                )}
                {st === "em_progresso" && (
                  <span className="text-[10px] font-bold text-white">{e.etapa_numero}</span>
                )}
                {(st === "atrasado" || st === "atencao") && (
                  <span className="text-[10px] font-bold text-white">!</span>
                )}
                {st === "futura" && (
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {e.etapa_numero}
                  </span>
                )}
              </div>
              <div className="text-center">
                <div className="text-[10px] font-mono text-muted-foreground">{diaLabel}</div>
                <div className="text-[11px] font-medium leading-tight">
                  {ETAPA_NOMES[e.etapa_codigo] ?? e.etapa_codigo}
                </div>
                <div className="text-[9px] text-muted-foreground/70">
                  {formatEtapaRangeDates(e.d0_date, e.dia_inicio_previsto, e.dia_fim_previsto)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t pt-3 text-[10px] text-muted-foreground">
        <Legend dotClass={dotStyle.concluido} label="Concluído" />
        <Legend dotClass={dotStyle.em_progresso} label="Em progresso" />
        <Legend dotClass={dotStyle.atencao} label="Atenção (deveria estar rolando)" />
        <Legend dotClass={dotStyle.atrasado} label="Atrasado" />
        <Legend dotClass={dotStyle.futura} label="Futura" />
      </div>
    </div>
  );
}

function Legend({ dotClass, label }: { dotClass: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2 w-2 rounded-full ring-2 ${dotClass}`} />
      {label}
    </span>
  );
}
