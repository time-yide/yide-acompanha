import { CheckCircle2, RefreshCw, Send } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { TaskRevisao } from "@/lib/tarefas/queries";

interface Props {
  revisoes: TaskRevisao[];
}

const TIPO_META: Record<
  TaskRevisao["tipo"],
  { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }
> = {
  envio: {
    label: "Enviado para análise",
    icon: Send,
    tone: "bg-sky-500/15 text-sky-700 dark:text-sky-400 ring-sky-500/30",
  },
  aprovacao: {
    label: "Aprovado",
    icon: CheckCircle2,
    tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 ring-emerald-500/30",
  },
  ajustes: {
    label: "Ajustes solicitados",
    icon: RefreshCw,
    tone: "bg-amber-500/15 text-amber-700 dark:text-amber-400 ring-amber-500/30",
  },
};

function formatDateTimeBR(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${date} às ${time}`;
}

export function RevisionsTimeline({ revisoes }: Props) {
  if (revisoes.length === 0) {
    return (
      <Card className="p-5">
        <h3 className="mb-2 text-sm font-semibold">Histórico de revisões</h3>
        <p className="text-xs text-muted-foreground">
          Nenhuma revisão ainda. O histórico aparece aqui após o primeiro envio para análise.
        </p>
      </Card>
    );
  }

  return (
    <Card className="space-y-4 p-5">
      <h3 className="text-sm font-semibold">Histórico de revisões</h3>
      <ol className="relative space-y-4 border-l border-border pl-5">
        {revisoes.map((r) => {
          const meta = TIPO_META[r.tipo];
          const Icon = meta.icon;
          return (
            <li key={r.id} className="relative">
              <span
                className={`absolute -left-[27px] flex h-5 w-5 items-center justify-center rounded-full ring-2 ${meta.tone}`}
                aria-hidden
              >
                <Icon className="h-3 w-3" />
              </span>
              <div className="space-y-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-sm font-medium">{meta.label}</span>
                  <span className="text-xs text-muted-foreground">
                    por {r.autor?.nome ?? ""} · {formatDateTimeBR(r.criado_em)}
                  </span>
                </div>
                {r.observacoes && (
                  <div className="rounded-md border bg-muted/40 p-2.5 text-xs whitespace-pre-wrap">
                    {r.observacoes}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
