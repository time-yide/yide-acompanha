import Link from "next/link";
import { AlertTriangle, PauseCircle, ListTodo, CalendarOff, CheckCircle2 } from "lucide-react";
import type { TarefasMetricas, RankItem } from "@/lib/tarefas/metricas";
import { PARADA_DIAS } from "@/lib/tarefas/metricas";

interface Props {
  metricas: TarefasMetricas;
  /** id → nome do responsável, pra rotular as listas. */
  nomePorId: Record<string, string>;
}

function plural(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

export function TarefasMetricasSection({ metricas, nomePorId }: Props) {
  const { atrasadas, paradas, emAberto, semPrazo, tempoMedioConclusaoDias } = metricas;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Card
          icon={AlertTriangle}
          tone="rose"
          titulo="Atrasadas"
          valor={String(atrasadas.count)}
          sub={atrasadas.count > 0 ? `${atrasadas.mediaDias}d de atraso em média` : "nenhuma vencida"}
        />
        <Card
          icon={PauseCircle}
          tone="amber"
          titulo={`Paradas (${PARADA_DIAS}+ dias)`}
          valor={String(paradas.count)}
          sub={paradas.count > 0 ? `${paradas.mediaDias}d sem mexer em média` : "todas com movimento"}
        />
        <Card
          icon={ListTodo}
          tone="slate"
          titulo="Em aberto"
          valor={String(emAberto)}
          sub="tarefas ainda em andamento"
        />
        <Card
          icon={CalendarOff}
          tone="slate"
          titulo="Sem prazo"
          valor={String(semPrazo)}
          sub="em aberto sem data"
        />
        <Card
          icon={CheckCircle2}
          tone="emerald"
          titulo="Tempo de conclusão"
          valor={tempoMedioConclusaoDias === null ? "—" : `${tempoMedioConclusaoDias}d`}
          sub="média criação → conclusão"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RankCard
          titulo="Mais atrasadas"
          vazio="Nenhuma tarefa atrasada 🎉"
          sufixo="de atraso"
          items={atrasadas.top}
          nomePorId={nomePorId}
        />
        <RankCard
          titulo="Mais paradas"
          vazio="Nenhuma tarefa parada 🎉"
          sufixo="sem mexer"
          items={paradas.top}
          nomePorId={nomePorId}
        />
      </div>
    </div>
  );
}

const TONES: Record<string, string> = {
  rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  slate: "bg-muted text-muted-foreground",
};

function Card({
  icon: Icon,
  tone,
  titulo,
  valor,
  sub,
}: {
  icon: typeof AlertTriangle;
  tone: keyof typeof TONES | string;
  titulo: string;
  valor: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className={`mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg ${TONES[tone] ?? TONES.slate}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-2xl font-bold tracking-tight">{valor}</div>
      <div className="text-xs font-medium text-foreground">{titulo}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}

function RankCard({
  titulo,
  vazio,
  sufixo,
  items,
  nomePorId,
}: {
  titulo: string;
  vazio: string;
  sufixo: string;
  items: RankItem[];
  nomePorId: Record<string, string>;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold">{titulo}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{vazio}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((t) => (
            <li key={t.id}>
              <Link
                href={`/tarefas/${t.id}`}
                className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm">{t.titulo}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {t.responsavelId ? nomePorId[t.responsavelId] ?? "—" : "sem responsável"}
                  </span>
                </span>
                <span className="shrink-0 whitespace-nowrap text-xs font-semibold text-foreground">
                  {plural(t.dias, "dia", "dias")} <span className="font-normal text-muted-foreground">{sufixo}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
