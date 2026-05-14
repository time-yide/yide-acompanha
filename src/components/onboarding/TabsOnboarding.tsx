import Link from "next/link";
import { LayoutGrid, XCircle, BarChart3 } from "lucide-react";

type TabKey = "kanban" | "perdidos" | "relatorios";

interface Props {
  active: TabKey;
}

const TABS: Array<{ key: TabKey; label: string; href: string; Icon: typeof LayoutGrid }> = [
  { key: "kanban", label: "Kanban", href: "/onboarding", Icon: LayoutGrid },
  { key: "perdidos", label: "Perdidos", href: "/onboarding/perdidos", Icon: XCircle },
  { key: "relatorios", label: "Relatórios", href: "/onboarding/relatorios", Icon: BarChart3 },
];

export function TabsOnboarding({ active }: Props) {
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
