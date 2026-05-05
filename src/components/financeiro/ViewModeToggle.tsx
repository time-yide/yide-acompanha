"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

type Mode = "mes" | "6m" | "ytd";

const MODES: { key: Mode; label: string }[] = [
  { key: "mes", label: "Mês" },
  { key: "6m", label: "6 meses" },
  { key: "ytd", label: "YTD" },
];

export function ViewModeToggle({ current }: { current: Mode }) {
  const router = useRouter();
  const params = useSearchParams();

  function setMode(m: Mode) {
    const sp = new URLSearchParams(params.toString());
    if (m === "mes") sp.delete("mode");
    else sp.set("mode", m);
    router.push(`/financeiro?${sp.toString()}`);
  }

  return (
    <div className="inline-flex items-center rounded-md border bg-card p-0.5">
      {MODES.map((m) => (
        <button
          key={m.key}
          type="button"
          onClick={() => setMode(m.key)}
          className={cn(
            "rounded px-2.5 py-1 text-xs font-medium transition-colors",
            current === m.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
