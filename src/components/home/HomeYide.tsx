"use client";
import { useLayoutEffect } from "react";
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

      <div>
        <Hero titulo={config.hero_titulo} sub={config.hero_sub} />
        <Numeros stats={config.stats} />
        <ServicosBento servicos={servicos} />
        <CasesDestaque cases={cases} />
        <Depoimentos depoimentos={depoimentos} />
        <Sobre titulo={config.sobre_titulo} texto={config.sobre_texto} />
        <Clientes clientes={config.clientes} />
        <CtaContato titulo={config.cta_titulo} />
      </div>
    </div>
  );
}
