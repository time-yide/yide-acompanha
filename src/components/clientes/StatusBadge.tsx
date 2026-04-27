import { Badge } from "@/components/ui/badge";

const map: Record<string, { label: string; cls: string }> = {
  ativo: { label: "Ativo", cls: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400" },
  churn: { label: "Churn", cls: "border-rose-500/40 text-rose-600 dark:text-rose-400" },
  em_onboarding: { label: "Onboarding", cls: "border-blue-500/40 text-blue-600 dark:text-blue-400" },
};

export function StatusBadge({ status }: { status: string }) {
  const m = map[status] ?? { label: status, cls: "" };
  return <Badge variant="outline" className={m.cls}>{m.label}</Badge>;
}
