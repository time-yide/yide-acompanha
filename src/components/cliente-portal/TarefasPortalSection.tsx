import {
  Activity,
  Video,
  Palette,
  Briefcase,
  ExternalLink,
  Check,
  Send,
  CheckCheck,
  Loader2,
  CalendarClock,
} from "lucide-react";
import type { PortalTaskRow, PortalTaskStatus } from "@/lib/cliente-portal/queries";

interface Props {
  tarefas: PortalTaskRow[];
}

const TIPO_ICON: Record<PortalTaskRow["tipo"], React.ReactNode> = {
  video: <Video className="h-3 w-3" />,
  arte: <Palette className="h-3 w-3" />,
  geral: <Briefcase className="h-3 w-3" />,
};

const TIPO_LABEL: Record<PortalTaskRow["tipo"], string> = {
  video: "Vídeo",
  arte: "Arte",
  geral: "Tarefa",
};

const STATUS_LABEL: Record<PortalTaskStatus, string> = {
  em_producao: "Em produção",
  em_revisao: "Em revisão",
  aprovada: "Aprovada",
  agendada: "Agendada",
  publicada: "Publicada",
  concluida: "Concluída",
};

const STATUS_TONE: Record<PortalTaskStatus, string> = {
  em_producao: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  em_revisao: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  aprovada: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  agendada: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  publicada: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  concluida: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

const STATUS_ICON: Record<PortalTaskStatus, React.ReactNode> = {
  em_producao: <Loader2 className="h-3 w-3" />,
  em_revisao: <Send className="h-3 w-3" />,
  aprovada: <Check className="h-3 w-3" />,
  agendada: <CalendarClock className="h-3 w-3" />,
  publicada: <CheckCheck className="h-3 w-3" />,
  concluida: <CheckCheck className="h-3 w-3" />,
};

const STATUSES_EM_ANDAMENTO: PortalTaskStatus[] = ["em_producao", "em_revisao"];

function formatRelative(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return "hoje";
  if (diffDays === 1) return "ontem";
  if (diffDays < 7) return `há ${diffDays} dias`;
  if (diffDays < 30) return `há ${Math.floor(diffDays / 7)} semanas`;
  return date.toLocaleDateString("pt-BR", {
    timeZone: "America/Cuiaba",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Acompanhamento de tarefas no portal do cliente. Mostra o QUE TÁ
 * SENDO FEITO pra ele, sem expor info interna (prazo, responsável,
 * prioridade, descrição). Decisão Yasmin: simples e direto.
 *
 * Status mostrados: em produção, em revisão, aprovada, agendada,
 * publicada, concluída. Esconde: aberta (não começou), alteração
 * (interno).
 */
export function TarefasPortalSection({ tarefas }: Props) {
  // Nada cadastrado nas últimas 60d → não polui o portal
  if (tarefas.length === 0) return null;

  const emAndamento = tarefas.filter((t) => STATUSES_EM_ANDAMENTO.includes(t.status));
  const concluidas = tarefas.filter((t) => !STATUSES_EM_ANDAMENTO.includes(t.status));

  return (
    <section className="overflow-hidden rounded-2xl border bg-card">
      <div className="bg-gradient-to-br from-primary/10 via-card to-card p-6 sm:p-8">
        <header className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider">
              Acompanhamento de tarefas
            </h2>
            <p className="text-xs text-muted-foreground">O que a Yide tá fazendo pra você</p>
          </div>
        </header>

        <div className="mt-5 space-y-4">
          {emAndamento.length > 0 && (
            <TaskList
              titulo={`Em andamento (${emAndamento.length})`}
              items={emAndamento}
            />
          )}
          {concluidas.length > 0 && (
            <TaskList
              titulo={`Recém concluídas (${concluidas.length})`}
              items={concluidas}
              muted
            />
          )}
        </div>
      </div>
    </section>
  );
}

function TaskList({
  titulo,
  items,
  muted,
}: {
  titulo: string;
  items: PortalTaskRow[];
  muted?: boolean;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {titulo}
      </p>
      <ul className="space-y-1.5">
        {items.map((t) => (
          <li key={t.id}>
            <div
              className={`flex items-start gap-3 rounded-lg border bg-background/40 p-3 ${muted ? "opacity-75" : ""}`}
            >
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                {TIPO_ICON[t.tipo]}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-sm font-medium">{t.titulo}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full border bg-muted/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {TIPO_LABEL[t.tipo]}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${STATUS_TONE[t.status]}`}
                  >
                    {STATUS_ICON[t.status]}
                    {STATUS_LABEL[t.status]}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatRelative(t.ultima_atualizacao)}
                  </span>
                </div>
              </div>
              {t.drive_link && (
                <a
                  href={t.drive_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex flex-shrink-0 items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/15"
                  title="Abrir entrega no Drive"
                >
                  <ExternalLink className="h-3 w-3" />
                  Ver
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
