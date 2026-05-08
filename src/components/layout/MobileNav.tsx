"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { Menu, Settings, X } from "lucide-react";
import { SidebarItem } from "./SidebarItem";
import { visibleNavItems } from "./nav-config";
import type { Role } from "@/lib/auth/permissions";
import type { SidebarBadges } from "./Sidebar";

interface Props {
  role: Role;
  nome: string;
  badges?: SidebarBadges;
}

export function MobileNav({ role, nome, badges }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const visible = visibleNavItems(role);

  // Fecha o drawer ao navegar. setTimeout tira o setState de dentro do
  // body do effect (passa no react-hooks/set-state-in-effect) sem mudar
  // a UX — o drawer fecha logo após a navegação.
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
        </div>
      )}
    </>
  );
}
