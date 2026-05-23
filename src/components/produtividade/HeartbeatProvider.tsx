"use client";

import { useEffect, useRef } from "react";

/** Frequência do heartbeat - 30s é suficiente pra "online" funcionar com
 *  janela de 2 min sem flicker. */
const HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * Pinga /api/produtividade/heartbeat enquanto a aba estiver aberta e visível.
 * Pausado em background tabs (document.hidden) - não consome rede à toa.
 *
 * Montado em layout authed pra rodar em todas as páginas internas.
 */
export function HeartbeatProvider() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPingRef = useRef<number>(0);

  useEffect(() => {
    async function ping() {
      // Throttle defensivo - se o setInterval disparar várias vezes seguido
      // (ex: aba volta do background), não manda múltiplos requests.
      const now = Date.now();
      if (now - lastPingRef.current < HEARTBEAT_INTERVAL_MS - 1000) return;
      lastPingRef.current = now;
      try {
        await fetch("/api/produtividade/heartbeat", {
          method: "POST",
          credentials: "same-origin",
          keepalive: true,
        });
      } catch {
        // Silencioso - rede caiu, próxima tentativa em 30s
      }
    }

    function startInterval() {
      if (intervalRef.current) return;
      // Ping imediato ao montar/voltar do background
      void ping();
      intervalRef.current = setInterval(ping, HEARTBEAT_INTERVAL_MS);
    }

    function stopInterval() {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    function handleVisibility() {
      if (document.hidden) stopInterval();
      else startInterval();
    }

    startInterval();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      stopInterval();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return null;
}
