import { SlidePreview } from "./SlidePreview";
import type { Slide } from "@/lib/apresenta-yide/tipos";

interface Props {
  slides: Slide[];
}

/**
 * Renderiza todos os slides empilhados verticalmente, cada um numa
 * "página" com page-break-after pra Puppeteer gerar 1 slide = 1 página
 * de PDF. Cada wrapper tem 100% de largura e altura proporcional 16:9 -
 * page CSS abaixo (no api route) força A4 landscape.
 */
export function PdfRenderableDeck({ slides }: Props) {
  return (
    <>
      {slides.map((slide, i) => (
        <div
          key={i}
          className="pdf-page"
          style={{
            width: "100%",
            // O wrapper toma a largura inteira; o slide interno (com
            // aspect-[16/9]) ajusta a altura proporcional.
            pageBreakAfter: i === slides.length - 1 ? "auto" : "always",
            breakAfter: i === slides.length - 1 ? "auto" : "page",
          }}
        >
          <SlidePreview slide={slide} />
        </div>
      ))}
    </>
  );
}
