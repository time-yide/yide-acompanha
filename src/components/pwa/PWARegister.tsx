"use client";

import { useEffect } from "react";

/**
 * Registra o service worker no client. Headless: não renderiza nada.
 * Coloca uma vez no layout raiz pra cobrir todas as páginas.
 *
 * Falha silenciosa: se o browser não suporta SW (raro hoje) ou está em
 * desenvolvimento sem HTTPS, só não registra — sem quebrar a UI.
 */
export function PWARegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => {
          // Silencia erros (HTTP em dev, política bloqueada, etc).
        });
    };

    // Aguarda window load pra não atrapalhar o first paint.
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }
  }, []);

  return null;
}
