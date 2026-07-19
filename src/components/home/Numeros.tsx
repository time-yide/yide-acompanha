"use client";
import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { Stat } from "@/lib/seo/home-config";

gsap.registerPlugin(ScrollTrigger);

interface NumerosProps {
  stats: Stat[];
}

/** Extrai prefixo, número e sufixo de um valor tipo "+100", "5+", "24/7". */
function parseValor(valor: string): { prefixo: string; numero: number | null; sufixo: string } {
  const m = valor.match(/^(\D*)(\d+)(\D*)$/);
  if (!m) return { prefixo: valor, numero: null, sufixo: "" };
  return { prefixo: m[1], numero: Number(m[2]), sufixo: m[3] };
}

export function Numeros({ stats }: NumerosProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const ctx = gsap.context(() => {
      const nums = root.querySelectorAll<HTMLElement>("[data-count]");
      nums.forEach((el) => {
        const target = Number(el.dataset.count);
        const prefixo = el.dataset.prefixo ?? "";
        const sufixo = el.dataset.sufixo ?? "";
        const proxy = { v: 0 };
        gsap.to(proxy, {
          v: target,
          duration: 1.6,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 85%", once: true },
          onUpdate: () => {
            el.textContent = `${prefixo}${Math.round(proxy.v)}${sufixo}`;
          },
        });
      });

      gsap.from(root.querySelectorAll<HTMLElement>("[data-stat]"), {
        y: 30,
        opacity: 0,
        stagger: 0.1,
        duration: 0.7,
        ease: "power3.out",
        scrollTrigger: { trigger: root, start: "top 80%", once: true },
      });
    }, root);

    return () => ctx.revert();
  }, []);

  if (stats.length === 0) return null;

  return (
    <section className="bg-[#faf9f7]">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-200 sm:grid-cols-4">
          {stats.map((s, i) => {
            const { prefixo, numero, sufixo } = parseValor(s.valor);
            return (
              <div key={i} data-stat className="group flex flex-col items-center gap-2 bg-white px-4 py-9 text-center">
                <div className="text-4xl font-extrabold tracking-tight text-teal-600 [font-family:var(--font-display)] sm:text-5xl">
                  {numero !== null ? (
                    <span
                      data-count={numero}
                      data-prefixo={prefixo}
                      data-sufixo={sufixo}
                    >
                      {s.valor}
                    </span>
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
