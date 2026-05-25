// src/components/trafego/relatorios/PdfRenderableDeck.tsx
//
// Renderiza todos os slides empilhados verticalmente, cada um numa
// "página" com page-break-after pra Puppeteer gerar 1 slide = 1 página
// de PDF. Cada wrapper tem 100% de largura; aspect-ratio 16:9 vem do
// CSS interno de cada slide (apresenta-yide convention).
import { SlidePreviewTrafego } from "./SlidePreviewTrafego";
import type { Slide } from "@/lib/trafego/relatorios/tipos";

interface Props {
  slides: Slide[];
  meta: {
    cliente_nome: string;
    periodo_inicio: string;
    periodo_fim: string;
  };
}

/**
 * Se o primeiro slide for `capa` sem subtitulo, injeta automaticamente
 * "{cliente} · {periodo}" como subtitulo pra dar contexto visual no PDF.
 */
function withInjectedSubtitulo(slides: Slide[], meta: Props["meta"]): Slide[] {
  if (slides.length === 0) return slides;
  const first = slides[0];
  if (first.content.template !== "capa" || first.content.subtitulo) return slides;
  const periodo = `${formatBR(meta.periodo_inicio)} a ${formatBR(meta.periodo_fim)}`;
  return [
    {
      template: "capa",
      content: {
        template: "capa",
        titulo: first.content.titulo,
        subtitulo: `${meta.cliente_nome} · ${periodo}`,
      },
    },
    ...slides.slice(1),
  ];
}

function formatBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function PdfRenderableDeck({ slides, meta }: Props) {
  const finalSlides = withInjectedSubtitulo(slides, meta);
  return (
    <>
      {finalSlides.map((slide, i) => (
        <div
          key={i}
          className="pdf-page"
          style={{
            width: "100%",
            pageBreakAfter: i === finalSlides.length - 1 ? "auto" : "always",
            breakAfter: i === finalSlides.length - 1 ? "auto" : "page",
          }}
        >
          <SlidePreviewTrafego slide={slide} />
        </div>
      ))}
    </>
  );
}
