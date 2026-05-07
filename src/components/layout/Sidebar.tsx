"use client";

import { Settings } from "lucide-react";
import Image from "next/image";
import { SidebarItem } from "./SidebarItem";
import { visibleNavItems } from "./nav-config";
import type { Role } from "@/lib/auth/permissions";

export interface SidebarBadges {
  recados?: number;
  escritorio?: number;
}

export function Sidebar({ role, nome, badges }: { role: Role; nome: string; badges?: SidebarBadges }) {
  const visible = visibleNavItems(role);

  return (
    <aside className="hidden w-[210px] flex-col border-r bg-card md:flex">
      <div className="flex items-center justify-center px-4 py-5">
        <Image
          src="/brand/logo-yide.png"
          alt="Yide Digital"
          width={811}
          height={450}
          sizes="80px"
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
