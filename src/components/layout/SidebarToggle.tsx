"use client";

import { useEffect, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

const STORAGE_KEY = "yide:sidebar-hidden";

function applyHidden(hidden: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.sidebar = hidden ? "hidden" : "visible";
}

/**
 * Botão de ocultar/mostrar a sidebar — só desktop. Mobile já usa drawer
 * via MobileNav (esse botão é hidden md:inline-flex).
 *
 * Persiste em localStorage e aplica via data-attribute no <html>. Sidebar
 * tem CSS em globals.css que esconde quando data-sidebar="hidden".
 */
export function SidebarToggle() {
  const [hidden, setHidden] = useState(false);
  // Carrega preferência do localStorage no mount. setTimeout(0) tira o
  // setState do body do effect (regra react-hooks/set-state-in-effect).
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY) === "1";
        setHidden(stored);
        applyHidden(stored);
      } catch {
        // localStorage bloqueado em modo privado — ignora silenciosamente
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  function toggle() {
    const next = !hidden;
    setHidden(next);
    applyHidden(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // ignora
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={hidden ? "Mostrar menu lateral" : "Ocultar menu lateral"}
      title={hidden ? "Mostrar menu lateral" : "Ocultar menu lateral"}
      className="hidden h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground md:inline-flex"
    >
      {hidden ? (
        <PanelLeftOpen className="h-4 w-4" />
      ) : (
        <PanelLeftClose className="h-4 w-4" />
      )}
    </button>
  );
}
