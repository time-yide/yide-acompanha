import Link from "next/link";
import { KanbanSquare, Briefcase, Mic } from "lucide-react";

export type TabKey = "onboarding" | "prospeccao" | "reunioes";

interface Props {
  active: TabKey;
}

// Prospecção e Reuniões saíram do menu lateral e viraram abas dentro de
// Onboarding — fluxo comercial faz mais sentido agrupado. Esse componente
// fica ACIMA do TabsOnboarding (abas internas do onboarding) e do TabsNav
// (abas internas do prospeccao).
const TABS: Array<{ key: TabKey; label: string; href: string; Icon: typeof KanbanSquare }> = [
  { key: "onboarding", label: "Onboarding", href: "/onboarding", Icon: KanbanSquare },
  { key: "prospeccao", label: "Prospecção", href: "/prospeccao", Icon: Briefcase },
  { key: "reunioes", label: "Reuniões", href: "/reunioes", Icon: Mic },
];

export function TabsOnboardingProspeccao({ active }: Props) {
  return (
    <nav className="flex flex-wrap items-center gap-1 border-b border-border/60 pb-px">
      {TABS.map(({ key, label, href, Icon }) => {
        const isActive = key === active;
        return (
          <Link
            key={key}
            href={href}
            className={
              isActive
                ? "inline-flex items-center gap-1.5 rounded-t-lg border border-b-0 border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary shadow-[0_0_24px_-12px] shadow-primary/40"
                : "inline-flex items-center gap-1.5 rounded-t-lg px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
            }
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
