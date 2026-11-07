/** FAQ com todas as respostas no HTML (lidas pelo Google e pelas IAs), abrindo com <details>. */
export function FaqAberto({ itens }: { itens: { pergunta: string; resposta: string }[] }) {
  if (itens.length === 0) return null;
  return (
    <div className="divide-y divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      {itens.map((f, i) => (
        <details key={f.pergunta} open={i === 0} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[15px] font-semibold [font-family:var(--font-display)] hover:bg-neutral-50 [&::-webkit-details-marker]:hidden">
            {f.pergunta}
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-teal-600 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
          </summary>
          <p className="px-5 pb-5 text-[15px] leading-relaxed text-neutral-600">{f.resposta}</p>
        </details>
      ))}
    </div>
  );
}
