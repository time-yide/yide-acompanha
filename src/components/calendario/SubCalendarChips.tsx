"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Video, User, Users, Briefcase, Cake, KanbanSquare, Building2, LayoutGrid, Code2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface ChipMeta {
  label: string;
  color: string;
  icon: LucideIcon;
  /** Visual destacado (ex: videomakers ganha cor especial quando ativo). */
  highlight?: boolean;
}

// "todas" = sem filtro (mostra tudo). "meus" = só eventos onde sou criador
// ou participante. Demais = filtro por sub_calendar específico. Apenas um
// pode estar ativo por vez (radio).
const labels: Record<string, ChipMeta> = {
  todas: { label: "Todas", color: "bg-foreground/40", icon: LayoutGrid },
  meus: { label: "Meus eventos", color: "bg-emerald-500", icon: User },
  videomakers: { label: "Videomakers", color: "bg-fuchsia-500", icon: Video, highlight: true },
  assessores: { label: "Assessores", color: "bg-amber-500", icon: Users },
  coordenadores: { label: "Coordenadores", color: "bg-orange-500", icon: Briefcase },
  programacao: { label: "Programação", color: "bg-cyan-500", icon: Code2 },
  agencia: { label: "Agência", color: "bg-violet-500", icon: Building2 },
  onboarding: { label: "Onboarding", color: "bg-blue-500", icon: KanbanSquare },
  aniversarios: { label: "Aniversários", color: "bg-pink-500", icon: Cake },
};

const ORDER = [
  "todas",
  "meus",
  "videomakers",
  "assessores",
  "coordenadores",
  "programacao",
  "agencia",
  "onboarding",
  "aniversarios",
] as const;

interface Props {
  /** Filtro ativo. null = "todas" (sem filtro). */
  current: string | null;
}

export function SubCalendarChips({ current }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const active = current ?? "todas";

  function select(key: string) {
    const sp = new URLSearchParams(params.toString());
    sp.delete("sub");
    if (key !== "todas") sp.set("sub", key);
    router.push(`/calendario?${sp.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {ORDER.map((k) => {
        const isActive = active === k;
        const meta = labels[k];
        const Icon = meta.icon;
        return (
          <button
            key={k}
            type="button"
            onClick={() => select(k)}
            className={[
              "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              isActive
                ? meta.highlight
                  ? "border-fuchsia-500 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300 ring-1 ring-fuchsia-500/30"
                  : "border-foreground/30 bg-card text-foreground shadow-sm"
                : "border-transparent bg-muted/40 text-muted-foreground hover:bg-muted",
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
