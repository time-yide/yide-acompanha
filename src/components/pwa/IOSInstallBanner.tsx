"use client";

import { useEffect, useState } from "react";
import { Share, X } from "lucide-react";

const STORAGE_KEY = "pwa-ios-install-dismissed";

function isIOSSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  const isIOSDevice =
    /iPad|iPhone|iPod/.test(ua) ||
    (ua.includes("Mac") && "ontouchend" in document); // iPad em modo desktop
  if (!isIOSDevice) return false;
  // Filtra browsers de terceiros no iOS (Chrome/Firefox/Edge) — nenhum
  // suporta "Adicionar à Tela de Início" com PWA real.
  return !/CriOS|FxiOS|EdgiOS/.test(ua);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // iOS expõe navigator.standalone; padrão moderno usa display-mode
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
}

export function IOSInstallBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    // setTimeout(0) tira o setState do body do effect (regra
    // react-hooks/set-state-in-effect). Roda no próximo tick.
    const t = setTimeout(() => {
      if (cancelled) return;
      if (!isIOSSafari()) return;
      if (isStandalone()) return;
      try {
        if (localStorage.getItem(STORAGE_KEY) === "1") return;
      } catch {
        // localStorage pode estar bloqueado em modo privado — continua mostrando
      }
      setShow(true);
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignora se storage indisponível
    }
    setShow(false);
  }

  if (!show) return null;

  return (
    <div
      className="fixed inset-x-3 z-50 rounded-xl border bg-card/95 p-3 shadow-lg backdrop-blur"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
      role="dialog"
      aria-label="Instalar app no iPhone"
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 text-sm">
          <p className="mb-1 font-semibold">Instale o app no iPhone</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Toque em{" "}
            <Share className="inline h-4 w-4 align-text-bottom text-primary" /> e depois
            &quot;Adicionar à Tela de Início&quot;. Notificações nativas só funcionam após
            instalar.
          </p>
        </div>
        <button
          onClick={dismiss}
          aria-label="Fechar"
          className="rounded-md p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
