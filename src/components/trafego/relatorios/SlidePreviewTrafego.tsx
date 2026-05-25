// src/components/trafego/relatorios/SlidePreviewTrafego.tsx
//
// Despacha pro componente certo baseado no template. Reusa os 6 slides
// do apresenta-yide (estruturalmente idênticos via Tailwind/identidade Yide)
// e adiciona o novo grafico_barras local.
import { SlideCapa } from "@/components/apresenta-yide/slides/SlideCapa";
import { SlideConteudo } from "@/components/apresenta-yide/slides/SlideConteudo";
import { SlideDuasColunas } from "@/components/apresenta-yide/slides/SlideDuasColunas";
import { SlideMetrica } from "@/components/apresenta-yide/slides/SlideMetrica";
import { SlideTopicosNumerados } from "@/components/apresenta-yide/slides/SlideTopicosNumerados";
import { SlideEncerramento } from "@/components/apresenta-yide/slides/SlideEncerramento";
import { SlideGraficoBarras } from "./SlideGraficoBarras";
import type {
  Slide,
  SlideCapa as TCapa,
  SlideConteudo as TConteudo,
  SlideDuasColunas as TDuasColunas,
  SlideMetrica as TMetrica,
  SlideTopicosNumerados as TTopicos,
  SlideEncerramento as TEncerramento,
} from "@/lib/trafego/relatorios/tipos";

interface Props {
  slide: Slide;
}

export function SlidePreviewTrafego({ slide }: Props) {
  switch (slide.content.template) {
    case "capa":
      // Reusa o componente do apresenta-yide. Os shapes são iguais (mesmas
      // chaves), só vivem em módulos diferentes — cast estrutural seguro.
      return <SlideCapa content={slide.content as TCapa as never} />;
    case "conteudo":
      return <SlideConteudo content={slide.content as TConteudo as never} />;
    case "duas_colunas":
      return <SlideDuasColunas content={slide.content as TDuasColunas as never} />;
    case "metrica":
      return <SlideMetrica content={slide.content as TMetrica as never} />;
    case "topicos_numerados":
      return <SlideTopicosNumerados content={slide.content as TTopicos as never} />;
    case "grafico_barras":
      return <SlideGraficoBarras content={slide.content} />;
    case "encerramento":
      return <SlideEncerramento content={slide.content as TEncerramento as never} />;
  }
}
