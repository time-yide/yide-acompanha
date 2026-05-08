"use client";

import { useEffect } from "react";

/**
 * Registra o service worker no client. Headless: não renderiza nada.
 * Coloca uma vez no layout raiz pra cobrir todas as páginas.
 *
 * Falha silenciosa: se o browser não suporta SW (raro hoje) ou está em
 * desenvolvimento sem HTTPS, só não registra — sem quebrar a UI.
 *
 * Auto-reload em update: quando o sw.js muda no servidor (bump do
 * SW_VERSION), o browser instala o novo SW. Esperamos ele virar
 * "activated" e damos reload pra carregar o HTML/JS novo. Sem isso, o
 * PWA instalado no iOS continua mostrando a versão velha por horas
 * até o usuário fechar o app no app switcher.
 */
export function PWARegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });

        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            // "activated" + já existe um controller (= não é primeira
            // instalação) significa que o SW antigo foi substituído por
            // um novo. Recarrega pra pegar HTML/JS atualizados.
            if (newWorker.state === "activated" && navigator.serviceWorker.controller) {
              window.location.reload();
            }
          });
        });
      } catch {
        // Silencia erros (HTTP em dev, política bloqueada, etc).
      }
    };

    // Aguarda window load pra não atrapalhar o first paint.
    if (document.readyState === "complete") {
      void register();
    } else {
      window.addEventListener("load", () => void register(), { once: true });
    }
  }, []);

  return null;
}
