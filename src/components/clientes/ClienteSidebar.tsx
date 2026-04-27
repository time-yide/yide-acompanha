"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutGrid, FileText, MessagesSquare, Folder, Calendar, ListChecks, History, Pencil,
} from "lucide-react";

type NavItem = {
  slug: string;
  icon: any;
  label: string;
  privileged?: boolean;
};

const items: NavItem[] = [
  { slug: "", icon: LayoutGrid, label: "Visão geral" },
  { slug: "/briefing", icon: FileText, label: "Briefing" },
  { slug: "/reunioes", icon: MessagesSquare, label: "Reuniões" },
  { slug: "/arquivos", icon: Folder, label: "Arquivos" },
  { slug: "/datas", icon: Calendar, label: "Datas importantes" },
  { slug: "/tarefas", icon: ListChecks, label: "Tarefas" },
  { slug: "/historico", icon: History, label: "Histórico", privileged: true },
  { slug: "/editar", icon: Pencil, label: "Editar dados" },
];

export function ClienteSidebar({ clientId, canSeeHistorico }: { clientId: string; canSeeHistorico: boolean }) {
  const pathname = usePathname();
  const base = `/clientes/${clientId}`;

  return (
    <aside className="w-full md:w-[200px] md:flex-shrink-0">
      <nav className="space-y-1 rounded-xl border bg-card p-2">
        {items
          .filter((it) => !it.privileged || canSeeHistorico)
          .map((it) => {
            const href = `${base}${it.slug}`;
            const active = pathname === href || (it.slug === "" && pathname === base);
            const Icon = it.icon;
            return (
              <Link
                key={it.slug}
                href={href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
                  active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{it.label}</span>
              </Link>
            );
          })}
      </nav>
    </aside>
  );
}
