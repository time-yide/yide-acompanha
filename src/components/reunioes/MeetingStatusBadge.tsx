import { Calendar, CircleDot, Loader2, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { MEETING_STATUS_LABEL, meetingStatusBadgeClass, type MeetingStatus } from "@/lib/reunioes/tipos";

const ICONS: Record<MeetingStatus, React.ComponentType<{ className?: string }>> = {
  scheduled: Calendar,
  in_progress: CircleDot,
  processing: Loader2,
  completed: CheckCircle2,
  failed: AlertTriangle,
  cancelled: XCircle,
};

export function MeetingStatusBadge({ status, compact }: { status: MeetingStatus; compact?: boolean }) {
  const Icon = ICONS[status];
  const isAnimated = status === "processing" || status === "in_progress";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${meetingStatusBadgeClass(status)}`}
    >
      <Icon className={`h-3 w-3 ${isAnimated ? (status === "processing" ? "animate-spin" : "animate-pulse") : ""}`} />
      {!compact && MEETING_STATUS_LABEL[status]}
    </span>
  );
}
