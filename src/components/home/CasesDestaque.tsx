"use client";
import { useLayoutEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface CaseItem {
  slug: string;
  cliente: string;
  segmento: string;
  resultados: { rotulo: string; valor: string }[];
  cover_image_url: string | null;
}
interface CasesDestaqueProps {
  cases: CaseItem[];
}

export function CasesDestaque({ cases }: CasesDestaqueProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const ctx = gsap.context(() => {
      gsap.from(root.querySelectorAll<HTMLElement>("[data-case]"), {
        y: 40,
        opacity: 0,
        stagger: 0.12,
        duration: 0.7,
        ease: "power3.out",
        scrollTrigger: { trigger: root, start: "top 80%", once: true },
      });
    }, root);

    return () => ctx.revert();
  }, []);

  if (cases.length === 0) return null;

  return (
    <section id="cases" className="bg-white">
      <div ref={rootRef} className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-teal-600">Resultados de verdade</p>
            <h2 className="text-3xl font-extrabold tracking-tight text-neutral-900 [font-family:var(--font-display)] sm:text-4xl">
              Cases em destaque
            </h2>
          </div>
          <Link href="/cases" className="inline-flex items-center gap-1 text-sm font-semibold text-teal-600 hover:text-teal-700">
            Ver todos <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cases.map((c) => {
            const primeiro = c.resultados[0];
            return (
              <Link
                key={c.slug}
                data-case
                href={`/cases/${c.slug}`}
                className="group flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white transition-all duration-300 hover:-translate-y-1 hover:border-teal-300 hover:shadow-[0_18px_50px_-20px_rgba(13,148,136,0.35)]"
              >
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-neutral-950">
                  {c.cover_image_url ? (
                    <Image
                      src={c.cover_image_url}
                      alt={c.cliente}
                      fill
                      sizes="(max-width: 640px) 100vw, 33vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-neutral-900 to-teal-950">
                      <span className="text-2xl font-bold text-teal-400/60 [font-family:var(--font-display)]">{c.cliente}</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-teal-600">{c.segmento}</p>
                  <h3 className="mt-1 text-lg font-bold tracking-tight text-neutral-900 [font-family:var(--font-display)]">{c.cliente}</h3>
                  {primeiro && (
                    <div className="mt-auto pt-4">
                      <p className="text-2xl font-extrabold text-teal-600 [font-family:var(--font-display)]">{primeiro.valor}</p>
                      <p className="text-sm text-neutral-500">{primeiro.rotulo}</p>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
