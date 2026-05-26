import Link from "next/link";
import { Share2, Presentation, ClipboardList } from "lucide-react";

export type TabKey = "agendamento" | "apresenta-yide" | "painel";

interface Props {
  active: TabKey;
}

// Ordem: Painel Mensal primeiro (default ao clicar em "Social Media" no menu
// — /social-media redirect pro /painel), depois Agendamento de Post (feed
// antigo movido pra /social-media/agendamento), depois Apresenta Yide.
const TABS: Array<{ key: TabKey; label: string; href: string; Icon: typeof Share2 }> = [
  { key: "painel", label: "Painel Mensal", href: "/painel", Icon: ClipboardList },
  { key: "agendamento", label: "Agendamento de Post", href: "/social-media/agendamento", Icon: Share2 },
  { key: "apresenta-yide", label: "Apresenta Yide", href: "/social-media/apresenta-yide", Icon: Presentation },
];

export function TabsSocialMedia({ active }: Props) {
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
