import { Pin } from "lucide-react";
import { RecadoCard } from "./RecadoCard";
import type { RecadoRow } from "@/lib/recados/queries";
import { groupByTier, TIER_LABELS, TIER_ORDER, type Tier } from "@/lib/recados/tiers";
import { cn } from "@/lib/utils";

const TIER_HEADER_BG: Record<Tier, string> = {
  socios: "bg-sky-900 text-white",
  coordenadores: "bg-sky-700 text-white",
  assessores: "bg-cyan-400 text-cyan-950",
  geral: "bg-muted text-foreground",
};

interface Props {
  recados: RecadoRow[];
  currentUserId: string;
  currentUserRole: string;
  emptyLabel: string;
}

export function RecadoFeed({ recados, currentUserId, currentUserRole, emptyLabel }: Props) {
  if (recados.length === 0) {
    return <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  const groups = groupByTier(recados);

  return (
    <div className="space-y-6">
      {groups.fixados.length > 0 && (
        <section className="space-y-3">
          <header className="flex items-center gap-2 rounded-md bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
            <Pin className="h-4 w-4" />
            Fixados
          </header>
          <div className="grid gap-3">
            {groups.fixados.map((r) => (
              <RecadoCard key={r.id} recado={r} currentUserId={currentUserId} currentUserRole={currentUserRole} />
            ))}
          </div>
        </section>
      )}

      {TIER_ORDER.map((tier) => {
        const list = groups[tier];
        if (list.length === 0) return null;
        return (
          <section key={tier} className="space-y-3">
            <header className={cn("rounded-md px-3 py-2 text-sm font-semibold", TIER_HEADER_BG[tier])}>
              {TIER_LABELS[tier]}
            </header>
            <div className="grid gap-3">
              {list.map((r) => (
                <RecadoCard key={r.id} recado={r} currentUserId={currentUserId} currentUserRole={currentUserRole} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
