"use client";

import { useState } from "react";

interface Props {
  conversationId: string;
  aiAtiva: boolean;
}

export function BadgeIAAtiva({ conversationId, aiAtiva: initialAiAtiva }: Props) {
  const [aiAtiva, setAiAtiva] = useState(initialAiAtiva);
  const [loading, setLoading] = useState(false);

  async function toggleIA() {
    setLoading(true);
    try {
      const resp = await fetch("/api/conversas/toggle-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, aiAtiva: !aiAtiva }),
      });
      if (resp.ok) setAiAtiva(!aiAtiva);
    } finally {
      setLoading(false);
    }
  }

  if (!aiAtiva) {
    return (
      <button
        onClick={toggleIA}
        disabled={loading}
        className="rounded-full border border-muted px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
      >
        {loading ? "..." : "Reativar IA"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
        IA ativa
      </span>
      <button
        onClick={toggleIA}
        disabled={loading}
        className="rounded-full border border-muted px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
      >
        {loading ? "..." : "Assumir"}
      </button>
    </div>
  );
}
