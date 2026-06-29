"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, List, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function ViewToggle({ current }: { current: "board" | "list" | "grafico" }) {
  const router = useRouter();
  const params = useSearchParams();

  function setView(v: "board" | "list" | "grafico") {
    const sp = new URLSearchParams(params.toString());
    if (v === "board") sp.delete("view");
    else sp.set("view", v);
    router.push(`/tarefas?${sp.toString()}`);
  }

  return (
    <div className="inline-flex items-center rounded-md border bg-card p-0.5">
      <button
        type="button"
        onClick={() => setView("board")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
          current === "board" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <LayoutGrid className="h-3.5 w-3.5" /> Quadro
      </button>
      <button
        type="button"
        onClick={() => setView("list")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
          current === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <List className="h-3.5 w-3.5" /> Lista
      </button>
      <button
        type="button"
        onClick={() => setView("grafico")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
          current === "grafico" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Share2 className="h-3.5 w-3.5" /> Gráfico
      </button>
    </div>
  );
}
