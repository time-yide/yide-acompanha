"use client";

import {
  LayoutGrid, Users, Briefcase, KanbanSquare, ListChecks,
  DollarSign, Smile, Calendar, UserCog, Settings, ClipboardList, MessageSquare,
} from "lucide-react";
import Image from "next/image";
import { SidebarItem } from "./SidebarItem";
import type { Role } from "@/lib/auth/permissions";

const navItems = [
  { href: "/", icon: LayoutGrid, label: "Dashboard", roles: "all", badgeKey: null },
  { href: "/clientes", icon: Users, label: "Clientes", roles: "all", badgeKey: null },
  { href: "/prospeccao", icon: Briefcase, label: "Prospecção", roles: ["adm", "socio", "comercial"], badgeKey: null },
  { href: "/onboarding", icon: KanbanSquare, label: "Onboarding", roles: "all", badgeKey: null },
  { href: "/tarefas", icon: ListChecks, label: "Tarefas", roles: "all", badgeKey: null },
  { href: "/recados", icon: MessageSquare, label: "Recados", roles: "all", badgeKey: "recados" as const },
  { href: "/painel", icon: ClipboardList, label: "Painel mensal", roles: ["adm", "socio", "coordenador", "assessor", "designer", "videomaker", "editor", "audiovisual_chefe"], badgeKey: null },
  { href: "/comissoes", icon: DollarSign, label: "Comissões", roles: "all", badgeKey: null },
  { href: "/satisfacao", icon: Smile, label: "Satisfação", roles: "all", badgeKey: null },
  { href: "/calendario", icon: Calendar, label: "Calendário Interno", roles: "all", badgeKey: null },
  { href: "/colaboradores", icon: UserCog, label: "Colaboradores", roles: "all", badgeKey: null },
] as const;

export interface SidebarBadges {
  recados?: number;
}

export function Sidebar({ role, nome, badges }: { role: Role; nome: string; badges?: SidebarBadges }) {
  const visible = navItems.filter(
    (item) => item.roles === "all" || (Array.isArray(item.roles) && item.roles.includes(role)),
  );

  return (
    <aside className="hidden w-[210px] flex-col border-r bg-card md:flex">
      <div className="flex items-center justify-center px-4 py-5">
        <Image
          src="/brand/logo-yide.png"
          alt="Yide Digital"
          width={811}
          height={450}
          className="h-auto w-20"
          priority
        />
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {visible.map((item) => (
          <SidebarItem
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.label}
            badge={item.badgeKey ? badges?.[item.badgeKey] : undefined}
          />
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
