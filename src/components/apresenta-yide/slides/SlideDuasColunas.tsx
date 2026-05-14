import { YideLogo } from "../YideLogo";
import type { SlideDuasColunas as SlideDuasColunasContent } from "@/lib/apresenta-yide/tipos";

interface Props {
  content: SlideDuasColunasContent;
}

export function SlideDuasColunas({ content }: Props) {
  return (
    <div className="relative flex aspect-[16/9] w-full flex-col bg-gradient-to-br from-[#0a0a0a] via-[#0f1419] to-[#0a0a0a] p-12">
      <header className="mb-10 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-white">{content.titulo}</h2>
        <div className="mx-auto mt-2 h-0.5 w-16 rounded-full bg-primary shadow-[0_0_12px] shadow-primary/60" />
      </header>

      <div className="grid flex-1 grid-cols-2 gap-8">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8">
          <h3 className="text-xl font-semibold text-primary">{content.coluna_esquerda.titulo}</h3>
          <p className="mt-3 text-base leading-relaxed text-gray-200">
            {content.coluna_esquerda.texto}
          </p>
        </div>
        <div className="rounded-2xl border border-primary/30 bg-primary/[0.05] p-8 shadow-[0_0_40px_-12px] shadow-primary/40">
          <h3 className="text-xl font-semibold text-primary">{content.coluna_direita.titulo}</h3>
          <p className="mt-3 text-base leading-relaxed text-gray-200">
            {content.coluna_direita.texto}
          </p>
        </div>
      </div>

      <div className="absolute bottom-6 right-12">
        <YideLogo size="small" />
      </div>
    </div>
  );
}
