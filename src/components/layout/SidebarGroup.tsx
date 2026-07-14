"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { SidebarItem } from "./SidebarItem";
import type { NavGroupItem, NavBadgeKey } from "./nav-config";

const STORAGE_KEY = "yide:sidebar-groups";

interface Props {
  groupId: string;
  label: string;
  items: readonly NavGroupItem[];
  badges?: Partial<Record<NavBadgeKey, number>>;
  /** Quando true, grupo nunca colapsa — sem botão de toggle. */
  alwaysExpanded?: boolean;
}

/**
 * Grupo recolhível na sidebar. Comportamento:
 * - Auto-abre se a rota atual está dentro do grupo (você nunca esconde
 *   a seção que está usando).
 * - Caso contrário, usa a preferência salva em localStorage.
 * - Click na setinha persiste a escolha por groupId em localStorage.
 *
 * Persistência via setTimeout dentro do effect pra não violar
 * react-hooks/set-state-in-effect (mesmo padrão do SidebarToggle).
 */
export function SidebarGroup({ groupId, label, items, badges, alwaysExpanded = false }: Props) {
  const pathname = usePathname();
  const containsActive = items.some(
    (i) => i.type === "link" && (pathname === i.href || pathname.startsWith(i.href + "/")),
  );

  // explicit: preferência do usuário em localStorage; null = nunca tocou.
  // open final = explicit ?? containsActive - auto-abre quando dentro.
  // Quando alwaysExpanded, ignora preferência e força aberto.
  const [explicit, setExplicit] = useState<boolean | null>(null);
  const open = alwaysExpanded ? true : (explicit ?? containsActive);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
        if (groupId in parsed) setExplicit(parsed[groupId]);
      } catch {
        // localStorage bloqueado em modo privado - ignora
      }
    }, 0);
    return () => clearTimeout(t);
  }, [groupId]);

  function toggle() {
    const next = !open;
    setExplicit(next);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
      parsed[groupId] = next;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    } catch {
      // ignora
    }
  }

  return (
    <div>
      {alwaysExpanded ? (
        // Sem botão: label estático e sempre aberto.
        <div className="flex w-full items-center px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          <span>{label}</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 transition-colors hover:text-foreground"
        >
          <span>{label}</span>
          {open ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>
      )}
      {open && (
        <div className="mt-0.5 space-y-1">
          {items.map((item, i) =>
            item.type === "subheader" ? (
              <div
                key={`sub-${item.label}-${i}`}
                className="px-3 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60"
              >
                {item.label}
              </div>
            ) : (
              <SidebarItem
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.label}
                badge={item.badgeKey ? badges?.[item.badgeKey] : undefined}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}
