"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/prospeccao/prospects", label: "Prospects" },
  { href: "/prospeccao/agenda", label: "Minha agenda" },
  { href: "/prospeccao/historico", label: "Histórico" },
  { href: "/prospeccao/metas", label: "Metas" },
  { href: "/prospeccao/funil", label: "Funil" },
];

export function TabsNav() {
  const pathname = usePathname();

  return (
    <nav className="border-b">
      <ul className="flex flex-wrap gap-1 -mb-px">
        {TABS.map((tab) => {
          const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={`inline-block px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
