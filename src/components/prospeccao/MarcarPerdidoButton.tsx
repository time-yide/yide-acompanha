"use client";

import { useState } from "react";
import { XCircle } from "lucide-react";
import { MarcarPerdidoDialog } from "./MarcarPerdidoDialog";

interface Props {
  leadId: string;
}

export function MarcarPerdidoButton({ leadId }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10"
      >
        <XCircle className="h-3.5 w-3.5" /> Marcar como perdido
      </button>
      <MarcarPerdidoDialog leadId={leadId} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
