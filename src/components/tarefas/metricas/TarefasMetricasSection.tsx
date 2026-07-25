import Link from "next/link";
import {
  AlertTriangle, PauseCircle, ListTodo, CalendarOff, CheckCircle2,
  ArrowUpRight, ChevronRight,
} from "lucide-react";
import type { TarefasMetricas, RankItem } from "@/lib/tarefas/metricas";
import { PARADA_DIAS } from "@/lib/tarefas/metricas";

interface Props {
  metricas: TarefasMetricas;
  /** id → nome do responsável, pra rotular as listas. */
  nomePorId: Record<string, string>;
}

type Tone = "rose" | "amber" | "emerald" | "slate";

// Paleta por tom: chip do ícone, cor do número, wash de fundo, barra, borda no
// hover e pílula. Fica dentro do design system (tokens shadcn + rose/amber/emerald).
const TONE: Record<Tone, {
  chip: string; num: string; wash: string; bar: string; ring: string; pill: string;
}> = {
  rose: {
    chip: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
    num: "text-rose-600 dark:text-rose-400",
    wash: "from-rose-500/10",
    bar: "bg-rose-500",
    ring: "hover:border-rose-500/40",
    pill: "bg-rose-500/15 text-rose-600 dark:text-rose-300",
  },
  amber: {
    chip: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    num: "text-amber-600 dark:text-amber-400",
    wash: "from-amber-500/10",
    bar: "bg-amber-500",
    ring: "hover:border-amber-500/40",
    pill: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  },
  emerald: {
    chip: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    num: "text-emerald-600 dark:text-emerald-400",
    wash: "from-emerald-500/10",
    bar: "bg-emerald-500",
    ring: "hover:border-emerald-500/40",
    pill: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  },
  slate: {
    chip: "bg-muted text-muted-foreground",
    num: "text-foreground",
    wash: "from-foreground/[0.04]",
    bar: "bg-muted-foreground/40",
    ring: "hover:border-foreground/20",
    pill: "bg-muted text-muted-foreground",
  },
};

function plural(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/** Iniciais (1–2 letras) do nome pra o avatar. "—" quando sem responsável. */
function iniciais(nome: string | null): string {
  if (!nome) return "—";
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function TarefasMetricasSection({ metricas, nomePorId }: Props) {
  const { atrasadas, paradas, emAberto, semPrazo, tempoMedioConclusaoDias } = metricas;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi
          icon={AlertTriangle}
          tone="rose"
          titulo="Atrasadas"
          valor={String(atrasadas.count)}
          sub={atrasadas.count > 0 ? `${atrasadas.mediaDias}d de atraso em média` : "nenhuma vencida"}
          href="/tarefas?view=list&groupBy=prazo"
        />
        <Kpi
          icon={PauseCircle}
          tone="amber"
          titulo={`Paradas (${PARADA_DIAS}+ dias)`}
          valor={String(paradas.count)}
          sub={paradas.count > 0 ? `${paradas.mediaDias}d sem mexer em média` : "todas com movimento"}
          href="/tarefas?view=list&groupBy=responsavel"
        />
        <Kpi
          icon={ListTodo}
          tone="slate"
          titulo="Em aberto"
          valor={String(emAberto)}
          sub="tarefas ainda em andamento"
          href="/tarefas"
        />
        <Kpi
          icon={CalendarOff}
          tone="slate"
          titulo="Sem prazo"
          valor={String(semPrazo)}
          sub="em aberto sem data"
          href="/tarefas?view=list&groupBy=prazo"
        />
        <Kpi
          icon={CheckCircle2}
          tone="emerald"
          titulo="Tempo de conclusão"
          valor={tempoMedioConclusaoDias === null ? "—" : `${tempoMedioConclusaoDias}d`}
          sub="média criação → conclusão"
          href="/tarefas?view=list&groupBy=prazo"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RankCard
          titulo="Mais atrasadas"
          vazio="Nenhuma tarefa atrasada 🎉"
          sufixo="de atraso"
          items={atrasadas.top}
          tone="rose"
          nomePorId={nomePorId}
        />
        <RankCard
          titulo="Mais paradas"
          vazio="Nenhuma tarefa parada 🎉"
          sufixo="sem mexer"
          items={paradas.top}
          tone="amber"
          nomePorId={nomePorId}
        />
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  tone,
  titulo,
  valor,
  sub,
  href,
}: {
  icon: typeof AlertTriangle;
  tone: Tone;
  titulo: string;
  valor: string;
  sub: string;
  href?: string;
}) {
  const t = TONE[tone];
  const inner = (
    <>
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${t.wash} to-transparent`} />
      <div className="relative">
        <div className="flex items-start justify-between">
          <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${t.chip}`}>
            <Icon className="h-4 w-4" />
          </span>
          {href && (
            <ArrowUpRight className="h-4 w-4 -translate-y-0.5 text-muted-foreground/50 opacity-0 transition duration-200 group-hover:translate-y-0 group-hover:opacity-100" />
          )}
        </div>
        <div className={`mt-3 text-3xl font-bold tracking-tight tabular-nums ${t.num}`}>{valor}</div>
        <div className="text-xs font-semibold text-foreground">{titulo}</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>
      </div>
      <span className={`absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 ${t.bar} transition-transform duration-300 group-hover:scale-x-100`} />
    </>
  );
  const cls = `group relative overflow-hidden rounded-2xl border bg-card p-4 transition duration-200 ${href ? `${t.ring} hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5` : ""}`;
  return href ? (
    <Link href={href} className={cls}>{inner}</Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

function RankCard({
  titulo,
  vazio,
  sufixo,
  items,
  tone,
  nomePorId,
}: {
  titulo: string;
  vazio: string;
  sufixo: string;
  items: RankItem[];
  tone: Tone;
  nomePorId: Record<string, string>;
}) {
  const t = TONE[tone];
  const max = items.length ? Math.max(1, ...items.map((i) => i.dias)) : 1;

  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{titulo}</h3>
        {items.length > 0 && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            top {items.length}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed py-8 text-center text-xs text-muted-foreground">{vazio}</p>
      ) : (
        <>
          <ul className="space-y-0.5">
            {items.map((it, i) => {
              const nome = it.responsavelId ? nomePorId[it.responsavelId] ?? null : null;
              const pct = Math.min(100, Math.round((it.dias / max) * 100));
              return (
                <li key={it.id}>
                  <Link
                    href={`/tarefas/${it.id}`}
                    className="group flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-muted/60"
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold tabular-nums ${i === 0 ? t.pill : "bg-muted text-muted-foreground"}`}
                    >
                      {i + 1}
                    </span>
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground"
                      title={nome ?? "sem responsável"}
                    >
                      {iniciais(nome)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{it.titulo}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{nome ?? "sem responsável"}</span>
                      <span className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-muted">
                        <span className={`block h-full rounded-full ${t.bar}`} style={{ width: `${pct}%` }} />
                      </span>
                    </span>
                    <span className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${t.pill}`}>
                      {plural(it.dias, "dia", "dias")}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 opacity-0 transition group-hover:opacity-100" />
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 px-2 text-[10px] text-muted-foreground/70">
            Dias {sufixo} · barra relativa ao maior da lista
          </p>
        </>
      )}
    </div>
  );
}
