"use client";
import { useLayoutEffect, useRef } from "react";
import type { Stat } from "@/lib/seo/home-config";

interface NumerosProps {
  stats: Stat[];
}

/** Extrai prefixo, número e sufixo de um valor tipo "+100", "5+", "24/7". */
function parseValor(valor: string): { prefixo: string; numero: number | null; sufixo: string } {
  const m = valor.match(/^(\D*)(\d+)(\D*)$/);
  if (!m) return { prefixo: valor, numero: null, sufixo: "" };
  return { prefixo: m[1], numero: Number(m[2]), sufixo: m[3] };
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export function Numeros({ stats }: NumerosProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const nums = Array.from(root.querySelectorAll<HTMLElement>("[data-count]"));
    const cards = Array.from(root.querySelectorAll<HTMLElement>("[data-stat]"));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || typeof IntersectionObserver === "undefined") return;

    // Zera os números e esconde os cards ANTES da pintura (sem flash do valor final).
    nums.forEach((el) => {
      const pre = el.dataset.prefixo ?? "";
      const suf = el.dataset.sufixo ?? "";
      el.textContent = `${pre}0${suf}`;
    });
    cards.forEach((el) => {
      el.style.opacity = "0";
      el.style.transform = "translateY(24px)";
    });

    let started = false;
    let raf = 0;
    const run = () => {
      if (started) return;
      started = true;
      // Entrada dos cards (stagger).
      cards.forEach((el, i) => {
        el.style.transition = "opacity .6s ease, transform .6s ease";
        el.style.transitionDelay = `${i * 90}ms`;
        requestAnimationFrame(() => {
          el.style.opacity = "1";
          el.style.transform = "none";
        });
      });
      // Contagem 0 -> alvo.
      const dur = 1800;
      const t0 = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / dur);
        const e = easeOut(p);
        nums.forEach((el) => {
          const target = Number(el.dataset.count);
          const pre = el.dataset.prefixo ?? "";
          const suf = el.dataset.sufixo ?? "";
          el.textContent = `${pre}${Math.round(target * e)}${suf}`;
        });
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (en.isIntersecting) {
            run();
            io.disconnect();
            break;
          }
        }
      },
      { threshold: 0.35 },
    );
    io.observe(root);

    return () => {
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  if (stats.length === 0) return null;

  return (
    <section className="bg-[#faf9f7]">
      <div ref={rootRef} className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-200 sm:grid-cols-4">
          {stats.map((s, i) => {
            const { prefixo, numero, sufixo } = parseValor(s.valor);
            return (
              <div key={i} data-stat className="group flex flex-col items-center gap-2 bg-white px-4 py-9 text-center">
                <div className="text-4xl font-extrabold tracking-tight text-teal-600 [font-family:var(--font-display)] sm:text-5xl">
                  {numero !== null ? (
                    <span data-count={numero} data-prefixo={prefixo} data-sufixo={sufixo}>{s.valor}</span>
                  ) : (
                    <span>{s.valor}</span>
                  )}
                </div>
                <div className="h-1 w-8 rounded-full bg-cyan-400/70 transition-all group-hover:w-12" />
                <p className="text-sm font-medium text-neutral-500">{s.rotulo}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
