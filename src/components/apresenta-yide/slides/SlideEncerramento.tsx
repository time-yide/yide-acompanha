import { YideLogo } from "../YideLogo";
import type { SlideEncerramento as SlideEncerramentoContent } from "@/lib/apresenta-yide/tipos";

interface Props {
  content: SlideEncerramentoContent;
}

export function SlideEncerramento({ content }: Props) {
  return (
    <div className="relative flex aspect-[16/9] w-full flex-col items-center justify-center bg-gradient-to-br from-[#0a0a0a] via-[#0f1419] to-[#0a0a0a] p-12 text-center">
      <h1 className="max-w-3xl text-balance text-5xl font-bold tracking-tight text-white">
        {content.mensagem}
      </h1>
      {content.cta && (
        <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-6 py-3 text-base font-semibold text-primary shadow-[0_0_30px_-8px] shadow-primary/50">
          {content.cta}
        </div>
      )}
      <div className="mt-12">
        <YideLogo size="large" />
      </div>
    </div>
  );
}
