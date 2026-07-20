"use client";

import { Settings } from "lucide-react";
import Image from "next/image";
import { SidebarItem } from "./SidebarItem";
import { SidebarGroup } from "./SidebarGroup";
import { visibleNavStructure } from "./nav-config";
import { roleLabel, type Role } from "@/lib/auth/permissions";

export interface SidebarBadges {
  recados?: number;
  escritorio?: number;
  yoriProntos?: number;
  solicitacoes?: number;
}

export function Sidebar({ role, nome, badges, especialidade }: { role: Role; nome: string; badges?: SidebarBadges; especialidade?: string | null }) {
  const visible = visibleNavStructure(role, especialidade);

  return (
    <aside data-role="sidebar" className="hidden w-[210px] flex-col border-r bg-card md:flex">
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

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-2">
        {visible.map((entry) =>
          entry.type === "link" ? (
            <SidebarItem
              key={entry.href}
              href={entry.href}
              icon={entry.icon}
              label={entry.label}
              badge={entry.badgeKey ? badges?.[entry.badgeKey] : undefined}
            />
          ) : (
            <SidebarGroup
              key={entry.id}
              groupId={entry.id}
              label={entry.label}
              items={entry.items}
              badges={badges}
              alwaysExpanded={entry.alwaysExpanded}
            />
          ),
        )}
      </nav>

      <div className="border-t px-3 py-3">
        <SidebarItem href="/configuracoes" icon={Settings} label="Configurações" />
        <div className="mt-3 px-3 text-xs text-muted-foreground">
          <div className="font-medium text-foreground">{nome}</div>
          <div className="mt-0.5">{roleLabel(role)}</div>
        </div>
      </div>
    </aside>
  );
}
