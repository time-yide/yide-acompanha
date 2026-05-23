import { SlideCapa } from "./slides/SlideCapa";
import { SlideConteudo } from "./slides/SlideConteudo";
import { SlideDuasColunas } from "./slides/SlideDuasColunas";
import { SlideMetrica } from "./slides/SlideMetrica";
import { SlideTopicosNumerados } from "./slides/SlideTopicosNumerados";
import { SlideEncerramento } from "./slides/SlideEncerramento";
import type { Slide } from "@/lib/apresenta-yide/tipos";

interface Props {
  slide: Slide;
}

/**
 * Despacha pro componente certo baseado no template do slide.
 * TypeScript garante exaustividade - se adicionar novo template
 * em tipos.ts, esse switch reclama até cobrir.
 */
export function SlidePreview({ slide }: Props) {
  switch (slide.content.template) {
    case "capa":
      return <SlideCapa content={slide.content} />;
    case "conteudo":
      return <SlideConteudo content={slide.content} />;
    case "duas_colunas":
      return <SlideDuasColunas content={slide.content} />;
    case "metrica":
      return <SlideMetrica content={slide.content} />;
    case "topicos_numerados":
      return <SlideTopicosNumerados content={slide.content} />;
    case "encerramento":
      return <SlideEncerramento content={slide.content} />;
  }
}
