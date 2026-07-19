"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";

/**
 * Glow radial teal que segue o mouse (spotlight).
 * Só monta em ponteiro fino (desktop) e respeita prefers-reduced-motion.
 * Atualiza CSS vars --gx/--gy via gsap.quickTo para suavizar o rastro.
 */
export function Cursor() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!finePointer || reduced) return;

    // Começa centralizado pra evitar salto inicial.
    gsap.set(el, { "--gx": `${window.innerWidth / 2}px`, "--gy": `${window.innerHeight / 2}px`, opacity: 1 });
    const qx = gsap.quickTo(el, "--gx", { duration: 0.5, ease: "power3.out" });
    const qy = gsap.quickTo(el, "--gy", { duration: 0.5, ease: "power3.out" });

    function onMove(e: MouseEvent) {
      qx(e.clientX);
      qy(e.clientY);
    }
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[60] opacity-0 mix-blend-screen"
      style={{
        background:
          "radial-gradient(420px circle at var(--gx, 50%) var(--gy, 50%), rgba(45,230,230,0.12), rgba(13,148,136,0.05) 40%, transparent 70%)",
      }}
    />
  );
}
