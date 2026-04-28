"use client";

import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { AgendarReuniaoDialog } from "./AgendarReuniaoDialog";

interface Props {
  leadId: string;
}

export function AgendarReuniaoButton({ leadId }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        <CalendarPlus className="h-3.5 w-3.5" /> Agendar reunião
      </button>
      <AgendarReuniaoDialog leadId={leadId} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
