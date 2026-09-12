"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { TranscriptionItem } from "@/lib/voz-ia/types";

export function TranscricaoExpandivel({ items }: { items: TranscriptionItem[] }) {
  const [open, setOpen] = useState(false);

  if (!items.length) return <span className="text-xs text-muted-foreground">Sem transcrição</span>;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        Transcrição ({items.length} mensagens)
      </button>
      {open && (
        <div className="mt-2 space-y-1.5 border-l-2 border-muted pl-3">
          {items.map((item, i) => (
            <div key={i} className="text-xs">
              <span className={`font-medium ${item.role === "assistant" ? "text-blue-600 dark:text-blue-400" : "text-foreground"}`}>
                {item.role === "assistant" ? "IA" : "Lead"}:
              </span>{" "}
              <span className="text-muted-foreground">{item.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
