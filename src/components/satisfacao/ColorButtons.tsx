"use client";

import { useState, useTransition } from "react";
import { setSatisfactionColorAction } from "@/lib/satisfacao/actions";
import type { SatisfactionColor } from "@/lib/satisfacao/schema";

interface Props {
  clientId: string;
  initialCor: SatisfactionColor | null;
}

const colorClasses: Record<SatisfactionColor, { active: string; inactive: string; emoji: string; label: string }> = {
  verde: {
    active: "bg-green-500/30 ring-2 ring-green-500 text-green-700 dark:text-green-300",
    inactive: "bg-green-500/10 hover:bg-green-500/20 text-green-700 dark:text-green-400",
    emoji: "🟢",
    label: "Verde",
  },
  amarelo: {
    active: "bg-amber-500/30 ring-2 ring-amber-500 text-amber-700 dark:text-amber-300",
    inactive: "bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400",
    emoji: "🟡",
    label: "Amarelo",
  },
  vermelho: {
    active: "bg-red-500/30 ring-2 ring-red-500 text-red-700 dark:text-red-300",
    inactive: "bg-red-500/10 hover:bg-red-500/20 text-red-700 dark:text-red-400",
    emoji: "🔴",
    label: "Vermelho",
  },
};

export function ColorButtons({ clientId, initialCor }: Props) {
  const [cor, setCor] = useState<SatisfactionColor | null>(initialCor);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function pick(c: SatisfactionColor) {
    setError(null);
    const previous = cor;
    setCor(c); // optimistic
    const fd = new FormData();
    fd.set("client_id", clientId);
    fd.set("cor", c);
    startTransition(async () => {
      const result = await setSatisfactionColorAction(fd);
      if ("error" in result) {
        setError(result.error);
        setCor(previous); // rollback
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      {(["verde", "amarelo", "vermelho"] as const).map((c) => {
        const cls = colorClasses[c];
        const isActive = cor === c;
        return (
          <button
            key={c}
            type="button"
            disabled={pending}
            onClick={() => pick(c)}
            aria-label={cls.label}
            className={`flex h-9 w-9 items-center justify-center rounded-lg text-base transition-colors disabled:opacity-50 ${
              isActive ? cls.active : cls.inactive
            }`}
          >
            {cls.emoji}
          </button>
        );
      })}
      {error && <span className="text-[10px] text-destructive">{error}</span>}
    </div>
  );
}
