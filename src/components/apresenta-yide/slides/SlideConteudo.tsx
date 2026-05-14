import { YideLogo } from "../YideLogo";
import type { SlideConteudo as SlideConteudoContent } from "@/lib/apresenta-yide/tipos";

interface Props {
  content: SlideConteudoContent;
}

export function SlideConteudo({ content }: Props) {
  return (
    <div className="relative flex aspect-[16/9] w-full flex-col bg-gradient-to-br from-[#0a0a0a] via-[#0f1419] to-[#0a0a0a] p-12">
      <header className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-white">{content.titulo}</h2>
        <div className="mt-2 h-0.5 w-16 rounded-full bg-primary shadow-[0_0_12px] shadow-primary/60" />
      </header>

      <div className="flex-1 space-y-6">
        {content.texto && (
          <p className="text-lg leading-relaxed text-gray-200">{content.texto}</p>
        )}
        {content.bullets && content.bullets.length > 0 && (
          <ul className="space-y-3">
            {content.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-3 text-base text-gray-200">
                <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary shadow-[0_0_8px] shadow-primary/80" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="absolute bottom-6 right-12">
        <YideLogo size="small" />
      </div>
    </div>
  );
}
