"use client";
import { useRef } from "react";
import { Quote } from "lucide-react";
import { useRevealOnView } from "./useRevealOnView";

interface Depoimento {
  texto: string;
  autor: string;
  cliente: string;
}
interface DepoimentosProps {
  depoimentos: Depoimento[];
}

export function Depoimentos({ depoimentos }: DepoimentosProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useRevealOnView(rootRef, "[data-depo]");

  if (depoimentos.length === 0) return null;

  return (
    <section className="bg-[#faf9f7]">
      <div ref={rootRef} className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
        <div className="mb-10 max-w-2xl">
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-teal-600">Quem confia</p>
          <h2 className="text-3xl font-extrabold tracking-tight text-neutral-900 [font-family:var(--font-display)] sm:text-4xl">
            O que dizem os clientes
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {depoimentos.map((d, i) => (
            <figure
              key={i}
              data-depo
              className="flex flex-col rounded-2xl border border-neutral-200 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
            >
              <Quote className="h-8 w-8 text-teal-500/40" aria-hidden />
              <blockquote className="mt-4 flex-1 text-neutral-700">
                <p className="leading-relaxed">{d.texto}</p>
              </blockquote>
              <figcaption className="mt-5 border-t border-neutral-100 pt-4">
                <p className="font-semibold text-neutral-900">{d.autor}</p>
                <p className="text-sm text-teal-600">{d.cliente}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
