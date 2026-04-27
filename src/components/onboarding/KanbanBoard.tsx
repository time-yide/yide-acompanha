import { KanbanColumn } from "./KanbanColumn";
import type { LeadRow } from "@/lib/leads/queries";
import type { Stage } from "@/lib/leads/schema";

const STAGES: Stage[] = ["prospeccao", "comercial", "contrato", "marco_zero", "ativo"];

export function KanbanBoard({ groups }: { groups: Record<Stage, LeadRow[]> }) {
  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-3">
        {STAGES.map((s) => (
          <KanbanColumn key={s} stage={s} leads={groups[s]} />
        ))}
      </div>
    </div>
  );
}
