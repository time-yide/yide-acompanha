import { YideLogo } from "../YideLogo";
import type { SlideCapa as SlideCapaContent } from "@/lib/apresenta-yide/tipos";

interface Props {
  content: SlideCapaContent;
}

/**
 * Slide de capa — primeira página. Logo Yide grande centralizada,
 * título grande, subtítulo opcional menor abaixo.
 */
export function SlideCapa({ content }: Props) {
  return (
    <div className="relative flex aspect-[16/9] w-full flex-col items-center justify-center bg-gradient-to-br from-[#0a0a0a] via-[#0f1419] to-[#0a0a0a] p-12 text-center shadow-[0_0_60px_-20px] shadow-primary/30">
      <div className="absolute left-12 top-12">
        <YideLogo size="small" />
      </div>

      <div className="mb-8">
        <YideLogo size="large" />
      </div>

      <h1 className="max-w-3xl text-balance text-5xl font-bold tracking-tight text-white">
        {content.titulo}
      </h1>
      {content.subtitulo && (
        <p className="mt-4 max-w-2xl text-xl text-gray-300">{content.subtitulo}</p>
      )}
    </div>
  );
}
