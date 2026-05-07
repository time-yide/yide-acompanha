"use client";

import { PainelCard } from "./PainelCard";
import type { ChecklistRow } from "@/lib/painel/queries";

interface Props {
  checklists: ChecklistRow[];
  userRole: string;
  userId: string;
}

export function PainelCardsList({ checklists, userRole, userId }: Props) {
  if (checklists.length === 0) {
    return (
      <p className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        Nenhum cliente ativo nesse filtro/mês.
      </p>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {checklists.map((row) => (
        <PainelCard key={row.client_id} row={row} userRole={userRole} userId={userId} />
      ))}
    </div>
  );
}
