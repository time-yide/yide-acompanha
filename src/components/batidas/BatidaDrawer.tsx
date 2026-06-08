"use client";

import { X } from "lucide-react";
import type { ProspectoCadencia } from "@/lib/batidas/aggregate";

interface Props {
  prospecto: ProspectoCadencia;
  onClose: () => void;
}

// STUB — implementação completa na Task 8.
export function BatidaDrawer({ prospecto, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div className="h-full w-full max-w-md bg-background p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-bold">{prospecto.nome}</h2>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{prospecto.totalBatidas}/{prospecto.meta} batidas</p>
      </div>
    </div>
  );
}
