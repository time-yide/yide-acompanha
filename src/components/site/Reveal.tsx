"use client";
import { useEffect, useRef, useState } from "react";

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  /** Atraso da animação em ms (para escalonar cards). */
  delay?: number;
  /** Tag do wrapper. Default: div. */
  as?: "div" | "section" | "li" | "header";
}

/**
 * Revela os filhos ao entrarem no viewport (fade + slide up), via
 * IntersectionObserver — leve, sem GSAP. Respeita prefers-reduced-motion:
 * se reduzido, o conteúdo aparece direto, sem transição.
 */
export function Reveal({ children, className = "", delay = 0, as = "div" }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // rAF evita setState síncrono no corpo do efeito (sem cascata de render).
      const raf = requestAnimationFrame(() => {
        setReduced(true);
        setShown(true);
      });
      return () => cancelAnimationFrame(raf);
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            io.disconnect();
            break;
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const Tag = as;
  return (
    <Tag
      // @ts-expect-error — ref é válido para todas as tags permitidas
      ref={ref}
      className={`${reduced ? "" : "transition-all duration-700 ease-out will-change-transform"} ${
        shown ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      } ${className}`}
      style={{ transitionDelay: shown && !reduced ? `${delay}ms` : "0ms" }}
    >
      {children}
    </Tag>
  );
}
