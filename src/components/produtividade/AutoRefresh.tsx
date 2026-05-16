"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface Props {
  /** Intervalo em segundos. Default 30. */
  intervalSeconds?: number;
}

/**
 * Force-refresha a página atual a cada N segundos. Usado no dashboard de
 * produtividade pra "tempo real" sem WebSocket — abordagem simples e
 * suficiente pra Fase 1 (Server Components re-rodam queries).
 *
 * Pausa quando aba está em background pra não pingar à toa.
 */
export function AutoRefresh({ intervalSeconds = 30 }: Props) {
  const router = useRouter();

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    function start() {
      if (interval) return;
      interval = setInterval(() => {
        router.refresh();
      }, intervalSeconds * 1000);
    }
    function stop() {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    }
    function onVisibility() {
      if (document.hidden) stop();
      else {
        router.refresh();
        start();
      }
    }

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router, intervalSeconds]);

  return null;
}
