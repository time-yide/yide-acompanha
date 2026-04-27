import { Badge } from "@/components/ui/badge";

const map: Record<string, string> = {
  alta: "border-rose-500/40 text-rose-600 dark:text-rose-400",
  media: "border-amber-500/40 text-amber-600 dark:text-amber-400",
  baixa: "border-muted-foreground/30 text-muted-foreground",
};

export function PriorityBadge({ prioridade }: { prioridade: string }) {
  return <Badge variant="outline" className={map[prioridade]}>{prioridade}</Badge>;
}
