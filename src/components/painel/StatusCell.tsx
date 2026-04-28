import type { StepStatus } from "@/lib/painel/deadlines";

interface Props {
  status: StepStatus | null;
}

const STATUS_DISPLAY: Record<StepStatus, { emoji: string; bg: string; label: string }> = {
  pendente: { emoji: "⚪", bg: "bg-slate-100 dark:bg-slate-800", label: "Pendente" },
  em_andamento: { emoji: "🟡", bg: "bg-amber-100 dark:bg-amber-900/30", label: "Em andamento" },
  pronto: { emoji: "🟢", bg: "bg-green-100 dark:bg-green-900/30", label: "Pronto" },
  atrasada: { emoji: "🔴", bg: "bg-red-100 dark:bg-red-900/30", label: "Atrasada" },
};

export function StatusCell({ status }: Props) {
  if (status === null) {
    return (
      <div className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-muted text-muted-foreground">
        —
      </div>
    );
  }

  const info = STATUS_DISPLAY[status];
  return (
    <div
      title={info.label}
      className={`inline-flex items-center justify-center w-8 h-8 rounded-md ${info.bg} text-base`}
    >
      {info.emoji}
    </div>
  );
}
