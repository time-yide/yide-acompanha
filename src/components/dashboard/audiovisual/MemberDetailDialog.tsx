"use client";

import Link from "next/link";
import { Calendar, Clock, ListTodo, ExternalLink, CheckCircle2, Wrench } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { GravacaoItem, TaskItem, CapturaItem } from "@/lib/dashboard/audiovisual";

interface VideomakerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nome: string;
  variant: "videomaker";
  proximasList: GravacaoItem[];
  hojeList: GravacaoItem[];
  concluidasList: CapturaItem[];
}

interface EditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nome: string;
  variant: "edicao";
  proximasList: TaskItem[];
  emAndamentoList: TaskItem[];
  concluidasList: TaskItem[];
}

type Props = VideomakerProps | EditorProps;

const STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  alteracao: "Alteração",
  em_aprovacao: "Em aprovação",
  concluida: "Concluída",
  aprovada: "Aprovada",
  agendado: "Agendado",
  postada: "Postada",
};

const PRIO_BADGE: Record<string, string> = {
  alta: "border-rose-500/40 text-rose-600 dark:text-rose-400",
  media: "border-amber-500/40 text-amber-600 dark:text-amber-400",
  baixa: "border-muted-foreground/30 text-muted-foreground",
};

function formatDateTimeBR(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
}

function formatDateOnlyBR(iso: string): string {
  const datePart = iso.length === 10 ? iso : iso.slice(0, 10);
  const [y, m, d] = datePart.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR");
}

function formatDueDateBR(iso: string | null): string {
  if (!iso) return "Sem prazo";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR");
}

function GravacaoRow({ g }: { g: GravacaoItem }) {
  return (
    <Link
      href="/calendario"
      className="flex items-start justify-between gap-2 rounded-lg border bg-card px-3 py-2 hover:bg-muted/40"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{g.titulo}</p>
        <p className="text-xs text-muted-foreground">{formatDateTimeBR(g.inicio)}</p>
      </div>
      <ExternalLink className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
    </Link>
  );
}

function CapturaRow({ c }: { c: CapturaItem }) {
  const href = c.task_id ? `/tarefas/${c.task_id}` : "/audiovisual";
  return (
    <Link
      href={href}
      className="flex items-start justify-between gap-2 rounded-lg border bg-card px-3 py-2 hover:bg-muted/40"
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="truncate text-sm font-medium">
          {c.cliente_nome ?? "Cliente —"}
          {c.task_titulo && <span className="ml-1 text-muted-foreground">· {c.task_titulo}</span>}
        </p>
        <p className="text-xs text-muted-foreground">{formatDateOnlyBR(c.data_captacao)}</p>
      </div>
      <ExternalLink className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
    </Link>
  );
}

function TaskRow({ t }: { t: TaskItem }) {
  return (
    <Link
      href={`/tarefas/${t.id}`}
      className="flex items-start justify-between gap-2 rounded-lg border bg-card px-3 py-2 hover:bg-muted/40"
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="truncate text-sm font-medium">{t.titulo}</p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{STATUS_LABEL[t.status] ?? t.status}</span>
          <span>· Prazo {formatDueDateBR(t.due_date)}</span>
          {t.prioridade && (
            <span className={`rounded border px-1.5 py-0 text-[10px] uppercase ${PRIO_BADGE[t.prioridade] ?? ""}`}>
              {t.prioridade}
            </span>
          )}
        </div>
      </div>
      <ExternalLink className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
    </Link>
  );
}

function Section({
  icon,
  titulo,
  count,
  children,
}: {
  icon: React.ReactNode;
  titulo: string;
  count: number;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div className="space-y-2">
      <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {icon} {titulo} ({count})
      </h4>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

export function MemberDetailDialog(props: Props) {
  const totalCount =
    props.variant === "videomaker"
      ? props.proximasList.length + props.hojeList.length + props.concluidasList.length
      : props.proximasList.length + props.emAndamentoList.length + props.concluidasList.length;

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {props.variant === "videomaker" ? <Calendar className="h-4 w-4" /> : <ListTodo className="h-4 w-4" />}
            {props.nome}
          </DialogTitle>
          <DialogDescription>
            {props.variant === "videomaker"
              ? "Gravações e capturas delegadas no período."
              : "Demandas de edição agrupadas por estado."}
          </DialogDescription>
        </DialogHeader>

        {totalCount === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
            Nada pra mostrar no período.
          </p>
        ) : (
          <div className="max-h-[60vh] space-y-4 overflow-y-auto">
            {props.variant === "videomaker" ? (
              <>
                <Section icon={<Clock className="h-3.5 w-3.5" />} titulo="Hoje" count={props.hojeList.length}>
                  {props.hojeList.map((g) => <GravacaoRow key={g.id} g={g} />)}
                </Section>
                <Section icon={<Calendar className="h-3.5 w-3.5" />} titulo="Próximas" count={props.proximasList.length}>
                  {props.proximasList.map((g) => <GravacaoRow key={g.id} g={g} />)}
                </Section>
                <Section icon={<CheckCircle2 className="h-3.5 w-3.5" />} titulo="Concluídas no período" count={props.concluidasList.length}>
                  {props.concluidasList.map((c) => <CapturaRow key={c.id} c={c} />)}
                </Section>
              </>
            ) : (
              <>
                <Section icon={<ListTodo className="h-3.5 w-3.5" />} titulo="Próximas" count={props.proximasList.length}>
                  {props.proximasList.map((t) => <TaskRow key={t.id} t={t} />)}
                </Section>
                <Section icon={<Wrench className="h-3.5 w-3.5" />} titulo="Em andamento" count={props.emAndamentoList.length}>
                  {props.emAndamentoList.map((t) => <TaskRow key={t.id} t={t} />)}
                </Section>
                <Section icon={<CheckCircle2 className="h-3.5 w-3.5" />} titulo="Concluídas no período" count={props.concluidasList.length}>
                  {props.concluidasList.map((t) => <TaskRow key={t.id} t={t} />)}
                </Section>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
