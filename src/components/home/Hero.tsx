"use client";
import { useLayoutEffect, useRef } from "react";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import gsap from "gsap";

interface HeroProps {
  titulo: string;
  sub: string;
}

/**
 * Hero escuro: título revelado palavra a palavra (stagger y+opacity),
 * "color wipe" teal no load, logo Yide flutuando. Respeita reduced-motion.
 */
export function Hero({ titulo, sub }: HeroProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const palavras = titulo.split(" ").filter(Boolean);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const ctx = gsap.context(() => {
      const words = root.querySelectorAll<HTMLElement>("[data-word]");
      const wipe = root.querySelector<HTMLElement>("[data-wipe]");
      const logo = root.querySelector<HTMLElement>("[data-logo]");
      const fades = root.querySelectorAll<HTMLElement>("[data-fade]");

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      // Color wipe: overlay teal varre a tela e some.
      if (wipe) {
        gsap.set(wipe, { transformOrigin: "left center", scaleX: 0 });
        tl.to(wipe, { scaleX: 1, duration: 0.5, ease: "power2.in" })
          .set(wipe, { transformOrigin: "right center" })
          .to(wipe, { scaleX: 0, duration: 0.6, ease: "power2.out" }, ">-0.05");
      }

      // Título por palavras.
      tl.from(
        words,
        { yPercent: 120, opacity: 0, stagger: 0.08, duration: 0.9 },
        wipe ? "-=0.5" : 0,
      );

      // Subtítulo e CTA.
      tl.from(fades, { y: 20, opacity: 0, stagger: 0.12, duration: 0.7 }, "-=0.5");

      // Logo entra e flutua.
      if (logo) {
        tl.from(logo, { y: 24, opacity: 0, duration: 0.8 }, "-=0.9");
        gsap.to(logo, { y: -10, repeat: -1, yoyo: true, duration: 2, ease: "sine.inOut" });
      }
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={rootRef} className="relative overflow-hidden bg-neutral-950 text-white">
      {/* color wipe overlay */}
      <div
        data-wipe
        aria-hidden
        className="pointer-events-none absolute inset-0 z-30 bg-gradient-to-r from-teal-500 via-cyan-400 to-teal-600"
      />
      {/* glow decorativo de fundo */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute -top-40 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-teal-500/20 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-cyan-400/10 blur-[100px]" />
      </div>

      <div className="relative z-10 mx-auto flex max-w-6xl flex-col items-center px-5 pb-24 pt-16 text-center sm:pt-24">
        <div data-logo className="mb-8">
          <Image
            src="/brand/logo-yide.png"
            alt="Yide Digital"
            width={160}
            height={88}
            priority
            className="h-16 w-auto sm:h-20"
          />
        </div>

        <h1 className="mx-auto max-w-4xl text-4xl font-extrabold leading-[1.05] tracking-tight [font-family:var(--font-display)] sm:text-6xl">
          {palavras.map((p, i) => (
            <span key={i} className="inline-block overflow-hidden pb-1 align-bottom">
              <span data-word className="inline-block">
                {p}
                {i < palavras.length - 1 ? " " : ""}
              </span>
            </span>
          ))}
        </h1>

        <p data-fade className="mx-auto mt-6 max-w-2xl text-lg text-white/65">
          {sub}
        </p>

        <div data-fade className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <a
            href="https://wa.me/5565981447380"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2 rounded-full bg-teal-500 px-7 py-3 text-base font-semibold text-neutral-950 shadow-[0_8px_30px_rgba(45,230,230,0.25)] transition-all hover:bg-cyan-400 hover:shadow-[0_10px_40px_rgba(45,230,230,0.4)]"
          >
            Falar no WhatsApp
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </a>
          <a
            href="#servicos"
            className="inline-flex items-center gap-2 rounded-full border border-white/20 px-7 py-3 text-base font-semibold text-white/80 transition-colors hover:border-white/40 hover:text-white"
          >
            Ver serviços
          </a>
        </div>
      </div>

      {/* fio de cor na base */}
      <div className="relative z-10 h-px w-full bg-gradient-to-r from-transparent via-cyan-400/70 to-transparent" />
    </section>
  );
}
