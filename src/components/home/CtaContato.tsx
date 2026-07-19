"use client";
import { useRef } from "react";
import { ArrowRight, Mail, MapPin, Phone } from "lucide-react";
import { YIDE_NAP } from "@/lib/seo/config";
import { useRevealOnView } from "./useRevealOnView";

interface CtaContatoProps {
  titulo: string;
}

export function CtaContato({ titulo }: CtaContatoProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useRevealOnView(rootRef, "[data-reveal]");

  return (
    <section id="contato" className="bg-[#faf9f7]">
      <div ref={rootRef} className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
        <div className="relative overflow-hidden rounded-3xl bg-neutral-950 px-6 py-14 text-center sm:px-16 sm:py-20">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-teal-500/25 blur-[100px]" />
            <div className="absolute bottom-0 right-10 h-56 w-56 rounded-full bg-cyan-400/15 blur-[90px]" />
          </div>
          <div className="relative z-10">
            <h2 data-reveal className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight text-white [font-family:var(--font-display)] sm:text-5xl">
              {titulo}
            </h2>
            <div data-reveal className="mt-8">
              <a
                href="https://wa.me/5565981447380"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 rounded-full bg-teal-500 px-8 py-3.5 text-base font-semibold text-neutral-950 shadow-[0_8px_30px_rgba(45,230,230,0.25)] transition-all hover:bg-cyan-400 hover:shadow-[0_10px_40px_rgba(45,230,230,0.4)]"
              >
                Falar no WhatsApp
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </a>
            </div>
            <div data-reveal className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-white/60">
              <a href={`tel:${YIDE_NAP.telefone.replace(/\s/g, "")}`} className="inline-flex items-center gap-2 transition-colors hover:text-white">
                <Phone className="h-4 w-4 text-teal-400" /> {YIDE_NAP.telefone}
              </a>
              <a href={`mailto:${YIDE_NAP.email}`} className="inline-flex items-center gap-2 transition-colors hover:text-white">
                <Mail className="h-4 w-4 text-teal-400" /> {YIDE_NAP.email}
              </a>
              <span className="inline-flex items-center gap-2">
                <MapPin className="h-4 w-4 text-teal-400" /> {YIDE_NAP.cidade} · {YIDE_NAP.uf}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
