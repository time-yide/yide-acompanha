"use client";

import { Suspense, use } from "react";
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

/** Itens do menu. `badges` pode chegar depois (streaming) — os itens
 *  renderizam na hora; só as bolinhas de contagem entram quando prontas. */
function NavItems({
  role,
  especialidade,
  badges,
}: {
  role: Role;
  especialidade?: string | null;
  badges?: SidebarBadges;
}) {
  const visible = visibleNavStructure(role, especialidade);
  return (
    <>
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
    </>
  );
}

/** Resolve a promessa de badges e re-renderiza os itens com as contagens. */
function NavItemsComBadges({
  role,
  especialidade,
  badgesPromise,
}: {
  role: Role;
  especialidade?: string | null;
  badgesPromise: Promise<SidebarBadges>;
}) {
  const badges = use(badgesPromise);
  return <NavItems role={role} especialidade={especialidade} badges={badges} />;
}

export function Sidebar({
  role,
  nome,
  badgesPromise,
  especialidade,
}: {
  role: Role;
  nome: string;
  badgesPromise: Promise<SidebarBadges>;
  especialidade?: string | null;
}) {
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
        {/* Os itens aparecem na hora (fallback sem badges); as bolinhas de
            contagem entram quando `badgesPromise` resolve — sem bloquear o
            primeiro paint da casca. */}
        <Suspense fallback={<NavItems role={role} especialidade={especialidade} />}>
          <NavItemsComBadges role={role} especialidade={especialidade} badgesPromise={badgesPromise} />
        </Suspense>
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
