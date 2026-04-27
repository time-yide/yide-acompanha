"use client";

import { useRouter, useSearchParams } from "next/navigation";

const labels = {
  agencia: { label: "Agência", color: "bg-violet-500" },
  onboarding: { label: "Onboarding", color: "bg-blue-500" },
  aniversarios: { label: "Aniversários", color: "bg-pink-500" },
} as const;

export function SubCalendarChips({ active }: { active: string[] }) {
  const router = useRouter();
  const params = useSearchParams();

  function toggle(key: string) {
    const set = new Set(active);
    if (set.has(key)) set.delete(key); else set.add(key);
    const sp = new URLSearchParams(params.toString());
    sp.delete("sub");
    set.forEach((k) => sp.append("sub", k));
    router.push(`/calendario?${sp.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(labels) as Array<keyof typeof labels>).map((k) => {
        const isActive = active.includes(k);
        const meta = labels[k];
        return (
          <button
            key={k}
            type="button"
            onClick={() => toggle(k)}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              isActive
                ? "border-foreground/20 bg-card"
                : "border-muted-foreground/20 bg-muted/40 text-muted-foreground"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${meta.color}`} />
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}
