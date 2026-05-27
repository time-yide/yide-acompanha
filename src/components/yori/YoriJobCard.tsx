import Link from "next/link";
import { Loader2, CheckCircle2, AlertCircle, Clock, XCircle } from "lucide-react";
import type { YoriJob } from "@/lib/yori/tipos";

interface Props {
  job: YoriJob;
}

const STATUS_LABELS: Record<YoriJob["status"], string> = {
  pending: "Na fila",
  transcribing: "Transcrevendo",
  rendering: "Renderizando",
  done: "Pronto",
  error: "Erro",
  cancelled: "Cancelado",
};

function StatusBadge({ status }: { status: YoriJob["status"] }) {
  const map: Record<YoriJob["status"], { icon: typeof Clock; cls: string }> = {
    pending: { icon: Clock, cls: "border-muted bg-muted/30 text-muted-foreground" },
    transcribing: { icon: Loader2, cls: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300" },
    rendering: { icon: Loader2, cls: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300" },
    done: { icon: CheckCircle2, cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
    error: { icon: AlertCircle, cls: "border-destructive/40 bg-destructive/10 text-destructive" },
    cancelled: { icon: XCircle, cls: "border-muted bg-muted/30 text-muted-foreground" },
  };
  const { icon: Icon, cls } = map[status];
  const isSpinning = status === "transcribing" || status === "rendering";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${cls}`}>
      <Icon className={`h-3 w-3 ${isSpinning ? "animate-spin" : ""}`} />
      {STATUS_LABELS[status]}
    </span>
  );
}

export function YoriJobCard({ job }: Props) {
  return (
    <Link
      href={`/audiovisual/yori/${job.id}`}
      prefetch={false}
      className="block rounded-lg border bg-card p-3 hover:bg-muted/30 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{job.video_filename}</p>
          <p className="text-[11px] text-muted-foreground">
            {new Date(job.created_at).toLocaleString("pt-BR")}
            {job.video_duration_seconds ? ` · ${job.video_duration_seconds}s` : ""}
          </p>
        </div>
        <StatusBadge status={job.status} />
      </div>
      {job.status === "error" && job.error_message && (
        <p className="mt-2 text-[11px] text-destructive truncate">{job.error_message}</p>
      )}
      {(job.status === "transcribing" || job.status === "rendering") && (
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${job.progress_pct}%` }} />
        </div>
      )}
    </Link>
  );
}
