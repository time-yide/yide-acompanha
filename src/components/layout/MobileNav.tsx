"use client";

import { Suspense, use, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { Menu, Settings, X } from "lucide-react";
import { SidebarItem } from "./SidebarItem";
import { SidebarGroup } from "./SidebarGroup";
import { visibleNavStructure } from "./nav-config";
import { roleLabel, type Role } from "@/lib/auth/permissions";
import type { SidebarBadges } from "./Sidebar";

interface Props {
  role: Role;
  nome: string;
  /** Contagens de badge — chegam por streaming (promessa). O drawer começa
   *  fechado, então as bolinhas nem são visíveis no primeiro paint. */
  badgesPromise: Promise<SidebarBadges>;
  especialidade?: string | null;
}

/** Itens do drawer. `badges` opcional — renderiza os itens mesmo sem contagem. */
function DrawerItems({
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

function DrawerItemsComBadges({
  role,
  especialidade,
  badgesPromise,
}: {
  role: Role;
  especialidade?: string | null;
  badgesPromise: Promise<SidebarBadges>;
}) {
  const badges = use(badgesPromise);
  return <DrawerItems role={role} especialidade={especialidade} badges={badges} />;
}

export function MobileNav({ role, nome, badgesPromise, especialidade }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Fecha o drawer ao navegar. setTimeout tira o setState de dentro do
  // body do effect (passa no react-hooks/set-state-in-effect) sem mudar
  // a UX - o drawer fecha logo após a navegação.
  useEffect(() => {
    const t = setTimeout(() => setOpen(false), 0);
    return () => clearTimeout(t);
  }, [pathname]);

  // Trava scroll do body enquanto aberto
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir menu"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/50"
          />

          {/* Drawer */}
          <aside
            className="absolute inset-y-0 left-0 flex w-[260px] max-w-[80vw] flex-col border-r bg-card shadow-xl"
            style={{
              paddingTop: "env(safe-area-inset-top)",
              paddingBottom: "env(safe-area-inset-bottom)",
            }}
          >
            <div className="flex items-center justify-between px-4 py-4">
              <Image
                src="/brand/logo-yide.png"
                alt="Yide Digital"
                width={811}
                height={450}
                sizes="80px"
                className="h-auto w-20"
                priority
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar menu"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-3">
              {/* Itens na hora (fallback sem badges); contagens entram quando a
                  promessa resolve — na prática já está pronta quando o usuário
                  abre o drawer. */}
              <Suspense fallback={<DrawerItems role={role} especialidade={especialidade} />}>
                <DrawerItemsComBadges role={role} especialidade={especialidade} badgesPromise={badgesPromise} />
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
        </div>
      )}
    </>
  );
}
