"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

const VIEWS: Array<{ key: "week" | "month"; label: string; shortcut: string }> = [
  { key: "week", label: "Semana", shortcut: "S" },
  { key: "month", label: "Mês", shortcut: "M" },
];

interface Props {
  current: "week" | "month";
}

export function ViewSwitch({ current }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const currentLabel = VIEWS.find((v) => v.key === current)?.label ?? "Semana";

  function select(view: "week" | "month") {
    const sp = new URLSearchParams(params.toString());
    // Limpa âncora de data - vai pra "hoje" na nova view, igual ao Google
    // (quando troca de view, mantém o foco em "agora").
    sp.delete("week");
    if (view === "month") sp.set("view", "month");
    else sp.delete("view");
    router.push(`/calendario${sp.toString() ? `?${sp.toString()}` : ""}`);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-card px-3 text-sm font-medium hover:bg-muted"
        aria-label="Trocar visualização"
      >
        {currentLabel}
        <ChevronDown className="h-4 w-4 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[140px]">
        {VIEWS.map((v) => (
          <DropdownMenuItem
            key={v.key}
            onClick={() => select(v.key)}
            className="cursor-pointer"
          >
            <span className="flex h-4 w-4 items-center justify-center">
              {current === v.key && <Check className="h-3.5 w-3.5" />}
            </span>
            <span className="flex-1">{v.label}</span>
            <span className="text-xs text-muted-foreground tabular-nums">{v.shortcut}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
