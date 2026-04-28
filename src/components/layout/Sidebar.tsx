"use client";

import {
  LayoutGrid, Users, Briefcase, KanbanSquare, ListChecks,
  DollarSign, Smile, Calendar, UserCog, Settings, ClipboardList,
} from "lucide-react";
import { SidebarItem } from "./SidebarItem";
import { BrandMark } from "@/components/brand/BrandMark";
import type { Role } from "@/lib/auth/permissions";

const navItems = [
  { href: "/", icon: LayoutGrid, label: "Dashboard", roles: "all" },
  { href: "/clientes", icon: Users, label: "Clientes", roles: "all" },
  { href: "/prospeccao", icon: Briefcase, label: "Prospecção", roles: ["adm", "socio", "comercial"] },
  { href: "/onboarding", icon: KanbanSquare, label: "Onboarding", roles: "all" },
  { href: "/tarefas", icon: ListChecks, label: "Tarefas", roles: "all" },
  { href: "/painel", icon: ClipboardList, label: "Painel mensal", roles: ["adm", "socio", "coordenador", "assessor", "designer", "videomaker", "editor", "audiovisual_chefe"] },
  { href: "/comissoes", icon: DollarSign, label: "Comissões", roles: "all" },
  { href: "/satisfacao", icon: Smile, label: "Satisfação", roles: "all" },
  { href: "/calendario", icon: Calendar, label: "Calendário Interno", roles: "all" },
  { href: "/colaboradores", icon: UserCog, label: "Colaboradores", roles: "all" },
] as const;

export function Sidebar({ role, nome }: { role: Role; nome: string }) {
  const visible = navItems.filter(
    (item) => item.roles === "all" || (Array.isArray(item.roles) && item.roles.includes(role)),
  );

  return (
    <aside className="hidden w-[210px] flex-col border-r bg-card md:flex">
      <div className="flex items-center gap-2 px-4 py-5">
        <BrandMark className="h-8 w-8" />
        <span className="text-sm font-bold tracking-tight">Yide</span>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {visible.map((item) => (
          <SidebarItem key={item.href} href={item.href} icon={item.icon} label={item.label} />
        ))}
      </nav>

      <div className="border-t px-3 py-3">
        <SidebarItem href="/configuracoes" icon={Settings} label="Configurações" />
        <div className="mt-3 px-3 text-xs text-muted-foreground">
          <div className="font-medium text-foreground">{nome}</div>
          <div className="mt-0.5 capitalize">{role}</div>
        </div>
      </div>
    </aside>
  );
}
