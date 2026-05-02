"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Video, User, Users, Briefcase, Cake, KanbanSquare, Building2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface ChipMeta {
  label: string;
  color: string;
  icon: LucideIcon;
  highlight?: boolean;
}

// "meus" não é um valor de sub_calendar — é uma marca especial que filtra
// eventos onde o usuário é criador OU participante.
const labels: Record<string, ChipMeta> = {
  meus: { label: "Meus eventos", color: "bg-emerald-500", icon: User },
  videomakers: { label: "Videomakers", color: "bg-fuchsia-500", icon: Video, highlight: true },
  assessores: { label: "Assessores", color: "bg-amber-500", icon: Users },
  coordenadores: { label: "Coordenadores", color: "bg-orange-500", icon: Briefcase },
  agencia: { label: "Agência", color: "bg-violet-500", icon: Building2 },
  onboarding: { label: "Onboarding", color: "bg-blue-500", icon: KanbanSquare },
  aniversarios: { label: "Aniversários", color: "bg-pink-500", icon: Cake },
};

const ORDER: Array<keyof typeof labels> = [
  "meus",
  "videomakers",
  "assessores",
  "coordenadores",
  "agencia",
  "onboarding",
  "aniversarios",
];

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
      {ORDER.map((k) => {
        const isActive = active.includes(k);
        const meta = labels[k];
        const Icon = meta.icon;
        return (
          <button
            key={k}
            type="button"
            onClick={() => toggle(k)}
            className={[
              "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              isActive
                ? meta.highlight
                  ? "border-fuchsia-500 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300 ring-1 ring-fuchsia-500/30"
                  : "border-foreground/20 bg-card"
                : "border-muted-foreground/20 bg-muted/40 text-muted-foreground",
            ].join(" ")}
          >
            <span className={`h-2 w-2 rounded-full ${meta.color}`} />
            <Icon className="h-3.5 w-3.5" />
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}
