"use client";
import { useLayoutEffect, type RefObject } from "react";

/**
 * Revela elementos (fade + slide up) quando o container entra na viewport, via
 * IntersectionObserver. À prova de falha: o conteúdo é visível por padrão no
 * HTML (SSR); só o JS esconde e revela. Sem JS/IO ou com reduced-motion, tudo
 * permanece visível.
 */
export function useRevealOnView(
  rootRef: RefObject<HTMLElement | null>,
  selector: string,
  stagger = 90,
) {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>(selector));
    if (!els.length) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || typeof IntersectionObserver === "undefined") return;
    els.forEach((el) => { el.style.opacity = "0"; el.style.transform = "translateY(28px)"; });
    let done = false;
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (en.isIntersecting && !done) {
          done = true;
          els.forEach((el, i) => {
            el.style.transition = "opacity .6s ease, transform .6s ease";
            el.style.transitionDelay = `${i * stagger}ms`;
            requestAnimationFrame(() => { el.style.opacity = "1"; el.style.transform = "none"; });
          });
          io.disconnect();
          break;
        }
      }
    }, { threshold: 0.1 });
    io.observe(root);
    return () => io.disconnect();
  }, [rootRef, selector, stagger]);
}
