import Link from "next/link";
import { Share2, Presentation, ClipboardList, Palette, Megaphone, Rocket } from "lucide-react";

export type TabKey = "agendamento" | "apresenta-yide" | "painel" | "design" | "trafego" | "d0-d30";

interface Props {
  active: TabKey;
}

// Ordem: Painel Mensal primeiro (default ao clicar em "Estratégia" no menu
// — /social-media redirect pro /painel), Agendamento, Design, Apresenta Yide,
// e por fim Tráfego e D0 → D30 (que saíram do menu lateral pra virar abas aqui).
const TABS: Array<{ key: TabKey; label: string; href: string; Icon: typeof Share2 }> = [
  { key: "painel", label: "Painel Mensal", href: "/painel", Icon: ClipboardList },
  { key: "agendamento", label: "Agendamento de Post", href: "/social-media/agendamento", Icon: Share2 },
  { key: "design", label: "Design", href: "/design", Icon: Palette },
  { key: "apresenta-yide", label: "Apresenta Yide", href: "/social-media/apresenta-yide", Icon: Presentation },
  { key: "trafego", label: "Tráfego", href: "/trafego", Icon: Megaphone },
  { key: "d0-d30", label: "D0 → D30", href: "/d0-d30", Icon: Rocket },
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
