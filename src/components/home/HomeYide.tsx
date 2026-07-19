"use client";
import { useLayoutEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { HomeConfig } from "@/lib/seo/home-config";
import { Cursor } from "./Cursor";
import { Hero } from "./Hero";
import { Numeros } from "./Numeros";
import { ServicosBento } from "./ServicosBento";
import { CasesDestaque } from "./CasesDestaque";
import { Depoimentos } from "./Depoimentos";
import { Sobre } from "./Sobre";
import { Clientes } from "./Clientes";
import { CtaContato } from "./CtaContato";
import { FooterHome } from "./FooterHome";

gsap.registerPlugin(ScrollTrigger);

export interface HomeData {
  config: HomeConfig;
  servicos: { id: string; nome: string; slug: string; descricao_base: string }[];
  cases: { slug: string; cliente: string; segmento: string; resultados: { rotulo: string; valor: string }[]; cover_image_url: string | null }[];
  depoimentos: { texto: string; autor: string; cliente: string }[];
}

export function HomeYide({ data }: { data: HomeData }) {
  const { config, servicos, cases, depoimentos } = data;

  useLayoutEffect(() => {
    // Garante que os triggers medem o layout depois das fontes/imagens.
    ScrollTrigger.refresh();
    return () => {
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  return (
    <div className="relative">
      <Cursor />

      {/* Nav escura sticky */}
      <header className="sticky top-0 z-50 bg-neutral-950/90 backdrop-blur supports-[backdrop-filter]:bg-neutral-950/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Link href="/site" className="flex items-center" aria-label="Yide Digital">
            <Image src="/brand/logo-yide.png" alt="Yide Digital" width={90} height={50} priority className="h-8 w-auto" />
          </Link>
          <nav className="flex items-center gap-4 sm:gap-6">
            <a href="#servicos" className="hidden text-sm font-medium text-white/60 transition-colors hover:text-white sm:inline">Serviços</a>
            <Link href="/cases" className="hidden text-sm font-medium text-white/60 transition-colors hover:text-white sm:inline">Cases</Link>
            <Link href="/blog" className="hidden text-sm font-medium text-white/60 transition-colors hover:text-white sm:inline">Blog</Link>
            <a href="#contato" className="hidden text-sm font-medium text-white/60 transition-colors hover:text-white sm:inline">Contato</a>
            <a
              href="https://wa.me/5565981447380"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-teal-500 px-4 py-1.5 text-sm font-semibold text-neutral-950 transition-colors hover:bg-cyan-400"
            >
              WhatsApp
            </a>
          </nav>
        </div>
      </header>

      <main>
        <Hero titulo={config.hero_titulo} sub={config.hero_sub} />
        <Numeros stats={config.stats} />
        <ServicosBento servicos={servicos} />
        <CasesDestaque cases={cases} />
        <Depoimentos depoimentos={depoimentos} />
        <Sobre titulo={config.sobre_titulo} texto={config.sobre_texto} />
        <Clientes clientes={config.clientes} />
        <CtaContato titulo={config.cta_titulo} />
      </main>

      <FooterHome />
    </div>
  );
}
