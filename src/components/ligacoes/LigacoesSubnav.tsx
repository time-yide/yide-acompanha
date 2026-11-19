import Link from "next/link";
import { KanbanSquare, Phone, Radar } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Abas de "Ligações": a página de ligações + Onboarding Ligação + Gerador de
 * Leads. Os dois últimos saíram do menu lateral e viraram subpáginas daqui.
 */
export type LigacoesSubnavKey = "ligacoes" | "onboarding" | "gerador";

const ITEMS: Array<{ key: LigacoesSubnavKey; href: string; label: string; icon: typeof Phone }> = [
  { key: "ligacoes", href: "/ligacoes", label: "Ligações", icon: Phone },
  { key: "onboarding", href: "/onboarding?canal=ligacao", label: "Onboarding Ligação", icon: KanbanSquare },
  { key: "gerador", href: "/gerador-leads", label: "Gerador de Leads", icon: Radar },
];

export function LigacoesSubnav({ active }: { active: LigacoesSubnavKey }) {
  return (
    <div className="border-b">
      <nav className="-mb-px flex flex-wrap gap-1" aria-label="Seções de Ligações">
        {ITEMS.map(({ key, href, label, icon: Icon }) => (
          <Link
            key={key}
            href={href}
            prefetch={false}
            className={cn(
              "inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              key === active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
