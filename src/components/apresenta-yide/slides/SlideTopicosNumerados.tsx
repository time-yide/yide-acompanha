import { YideLogo } from "../YideLogo";
import type { SlideTopicosNumerados as SlideTopicosContent } from "@/lib/apresenta-yide/tipos";

interface Props {
  content: SlideTopicosContent;
}

export function SlideTopicosNumerados({ content }: Props) {
  return (
    <div className="relative flex aspect-[16/9] w-full flex-col bg-gradient-to-br from-[#0a0a0a] via-[#0f1419] to-[#0a0a0a] p-12">
      <header className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-white">{content.titulo}</h2>
        <div className="mt-2 h-0.5 w-16 rounded-full bg-primary shadow-[0_0_12px] shadow-primary/60" />
      </header>

      <ol className="flex-1 space-y-5">
        {content.topicos.map((t, i) => (
          <li key={i} className="flex items-start gap-5">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-base font-bold text-primary shadow-[0_0_20px_-6px] shadow-primary/60">
              {i + 1}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">{t.titulo}</h3>
              {t.texto && <p className="mt-1 text-sm text-gray-300">{t.texto}</p>}
            </div>
          </li>
        ))}
      </ol>

      <div className="absolute bottom-6 right-12">
        <YideLogo size="small" />
      </div>
    </div>
  );
}
