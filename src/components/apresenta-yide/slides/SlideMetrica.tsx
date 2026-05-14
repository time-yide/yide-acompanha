import { YideLogo } from "../YideLogo";
import type { SlideMetrica as SlideMetricaContent } from "@/lib/apresenta-yide/tipos";

interface Props {
  content: SlideMetricaContent;
}

export function SlideMetrica({ content }: Props) {
  return (
    <div className="relative flex aspect-[16/9] w-full flex-col items-center justify-center bg-gradient-to-br from-[#0a0a0a] via-[#0f1419] to-[#0a0a0a] p-12 text-center">
      <div className="text-[10rem] font-bold leading-none tracking-tight text-primary drop-shadow-[0_0_40px_rgba(61,196,188,0.5)]">
        {content.numero}
      </div>
      <div className="mt-4 max-w-2xl text-2xl font-semibold text-white">
        {content.label}
      </div>
      {content.descricao && (
        <p className="mt-4 max-w-xl text-sm text-gray-400">{content.descricao}</p>
      )}
      <div className="absolute bottom-6 right-12">
        <YideLogo size="small" />
      </div>
    </div>
  );
}
