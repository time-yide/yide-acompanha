import Link from "next/link";
import { Megaphone, FileText, Database, Star } from "lucide-react";

export type TabKey = "trafego" | "relatorios" | "crm" | "gmb";

interface Props {
  active: TabKey;
}

// Ordem: Tráfego (root) → Relatórios → CRM → Painel GMB.
// CRM e GMB tiveram itens removidos do menu lateral; agora aparecem
// como subabas aqui (URLs /crm e /painel-gmb preservadas).
const TABS: Array<{ key: TabKey; label: string; href: string; Icon: typeof Megaphone }> = [
  { key: "trafego", label: "Tráfego", href: "/trafego", Icon: Megaphone },
  { key: "relatorios", label: "Relatórios", href: "/trafego/relatorios", Icon: FileText },
  { key: "crm", label: "CRM", href: "/crm", Icon: Database },
  { key: "gmb", label: "Painel GMB", href: "/painel-gmb", Icon: Star },
];

export function TabsTrafego({ active }: Props) {
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
