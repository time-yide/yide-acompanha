"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, Rows3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  current: "cards" | "tabela";
}

export function ViewToggle({ current }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  function setView(v: "cards" | "tabela") {
    const sp = new URLSearchParams(params.toString());
    if (v === "cards") sp.delete("view");
    else sp.set("view", v);
    router.push(`/painel?${sp.toString()}`);
  }

  return (
    <div className="inline-flex items-center rounded-md border bg-card p-0.5">
      <button
        type="button"
        onClick={() => setView("cards")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
          current === "cards" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <LayoutGrid className="h-3.5 w-3.5" /> Cards
      </button>
      <button
        type="button"
        onClick={() => setView("tabela")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
          current === "tabela" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Rows3 className="h-3.5 w-3.5" /> Tabela
      </button>
    </div>
  );
}
