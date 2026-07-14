import Link from "next/link";
import { BookOpen, GraduationCap } from "lucide-react";

export type ManualTabKey = "manual" | "academy";

interface Props {
  active: ManualTabKey;
}

/** Barra de abas: Manual da Yide + Yide Academy (que saiu do menu lateral). */
export function TabsManual({ active }: Props) {
  const tabs = [
    { key: "manual" as const, label: "Manual da Yide", href: "/manual", Icon: BookOpen },
    { key: "academy" as const, label: "Yide Academy", href: "/academy", Icon: GraduationCap },
  ];

  return (
    <nav className="flex flex-wrap items-center gap-1 border-b border-border/60 pb-px">
      {tabs.map(({ key, label, href, Icon }) => {
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
