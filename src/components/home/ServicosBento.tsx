"use client";
import { useRef } from "react";
import Link from "next/link";
import { ArrowUpRight, BarChart3, Code2, Share2, Sparkles, Megaphone, Database } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRevealOnView } from "./useRevealOnView";

interface Servico {
  id: string;
  nome: string;
  slug: string;
  descricao_base: string;
}
interface ServicosBentoProps {
  servicos: Servico[];
}

const ICONS: LucideIcon[] = [BarChart3, Code2, Share2, Database, Megaphone, Sparkles];
// Padrão de span do bento (repete pra qualquer quantidade).
const SPANS = ["sm:col-span-2 sm:row-span-2", "", "", "sm:col-span-2", "", ""];

export function ServicosBento({ servicos }: ServicosBentoProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useRevealOnView(rootRef, "[data-card]");

  if (servicos.length === 0) return null;

  return (
    <section id="servicos" className="bg-[#faf9f7]">
      <div ref={rootRef} className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
        <div className="mb-10 max-w-2xl">
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-teal-600">O que fazemos</p>
          <h2 className="text-3xl font-extrabold tracking-tight text-neutral-900 [font-family:var(--font-display)] sm:text-4xl">
            Serviços que movem o ponteiro
          </h2>
        </div>

        <div className="grid auto-rows-[minmax(180px,auto)] grid-cols-1 gap-4 sm:grid-cols-3">
          {servicos.map((s, i) => {
            const Icon = ICONS[i % ICONS.length];
            const span = SPANS[i % SPANS.length];
            const grande = span.includes("row-span-2");
            return (
              <Link
                key={s.id}
                data-card
                href={`/servicos/${s.slug}`}
                className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-neutral-200 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-teal-300 hover:shadow-[0_18px_50px_-20px_rgba(13,148,136,0.35)] ${span}`}
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-teal-500/5 blur-2xl transition-all group-hover:bg-teal-500/10"
                />
                <div className="relative">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-600 transition-colors group-hover:bg-teal-600 group-hover:text-white">
                    <Icon className="h-6 w-6" />
                  </span>
                </div>
                <div className="relative mt-6">
                  <h3 className={`font-bold tracking-tight text-neutral-900 [font-family:var(--font-display)] ${grande ? "text-2xl" : "text-xl"}`}>
                    {s.nome}
                  </h3>
                  <p className={`mt-2 text-neutral-500 ${grande ? "text-base" : "text-sm"}`}>{s.descricao_base}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-teal-600">
                    Saiba mais
                    <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
