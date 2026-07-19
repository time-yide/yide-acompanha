"use client";
import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface SobreProps {
  titulo: string;
  texto: string;
}

export function Sobre({ titulo, texto }: SobreProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const ctx = gsap.context(() => {
      const blobs = root.querySelectorAll<HTMLElement>("[data-parallax]");
      blobs.forEach((el) => {
        const speed = Number(el.dataset.parallax) || 0;
        gsap.to(el, {
          yPercent: speed,
          ease: "none",
          scrollTrigger: { trigger: root, start: "top bottom", end: "bottom top", scrub: true },
        });
      });

      gsap.from(root.querySelectorAll<HTMLElement>("[data-reveal]"), {
        y: 30,
        opacity: 0,
        stagger: 0.12,
        duration: 0.8,
        ease: "power3.out",
        scrollTrigger: { trigger: root, start: "top 75%", once: true },
      });
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <section id="sobre" className="relative overflow-hidden bg-neutral-950 text-white">
      {/* elementos decorativos com parallax */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div data-parallax="-25" className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-teal-500/15 blur-[100px]" />
        <div data-parallax="30" className="absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-cyan-400/10 blur-[110px]" />
      </div>

      <div ref={rootRef} className="relative z-10 mx-auto grid max-w-6xl gap-10 px-5 py-20 sm:py-28 md:grid-cols-2 md:items-center">
        <div>
          <p data-reveal className="mb-3 text-sm font-semibold uppercase tracking-widest text-cyan-400">Sobre nós</p>
          <h2 data-reveal className="text-3xl font-extrabold tracking-tight [font-family:var(--font-display)] sm:text-5xl">
            {titulo}
          </h2>
        </div>
        <div>
          <p data-reveal className="text-lg leading-relaxed text-white/70">{texto}</p>
          <div data-reveal className="mt-8 flex flex-wrap gap-3">
            {["Performance", "Dados", "Tecnologia", "IA"].map((t) => (
              <span key={t} className="rounded-full border border-white/15 px-4 py-1.5 text-sm font-medium text-white/70">
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
