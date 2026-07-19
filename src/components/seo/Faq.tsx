"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
export function Faq({ itens }: { itens: { pergunta: string; resposta: string }[] }) {
  const [aberto, setAberto] = useState<number | null>(0);
  if (itens.length === 0) return null;
  return (
    <div className="divide-y divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      {itens.map((f, i) => (
        <div key={i}>
          <button type="button" onClick={() => setAberto(aberto === i ? null : i)}
            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-[15px] font-semibold [font-family:var(--font-display)] hover:bg-neutral-50">
            {f.pergunta}
            <ChevronDown className={`h-4 w-4 shrink-0 text-teal-600 transition-transform ${aberto === i ? "rotate-180" : ""}`} />
          </button>
          {aberto === i && <p className="px-5 pb-5 text-[15px] leading-relaxed text-neutral-600">{f.resposta}</p>}
        </div>
      ))}
    </div>
  );
}
