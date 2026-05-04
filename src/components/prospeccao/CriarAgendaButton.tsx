"use client";

import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { CriarAgendaDialog } from "./CriarAgendaDialog";

interface Props {
  leads: Array<{ id: string; nome_prospect: string; stage: string }>;
}

export function CriarAgendaButton({ leads }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        <CalendarPlus className="h-3.5 w-3.5" /> Criar agenda
      </button>
      <CriarAgendaDialog leads={leads} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
