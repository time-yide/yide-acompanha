"use client";

interface ClientesProps {
  clientes: string[];
}

/** Faixa de chips de clientes. Se muitos (>8), vira marquee CSS. */
export function Clientes({ clientes }: ClientesProps) {
  if (clientes.length === 0) return null;
  const marquee = clientes.length > 8;

  const chip = (nome: string, key: string) => (
    <span
      key={key}
      className="inline-flex shrink-0 items-center rounded-full border border-neutral-200 bg-white px-5 py-2 text-sm font-semibold text-neutral-600"
    >
      {nome}
    </span>
  );

  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-5 py-14">
        <p className="mb-6 text-center text-sm font-semibold uppercase tracking-widest text-neutral-400">
          Marcas que crescem com a Yide
        </p>
        {marquee ? (
          <div className="group relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
            <div className="flex w-max animate-[marquee-home_30s_linear_infinite] gap-3 group-hover:[animation-play-state:paused]">
              {clientes.map((c, i) => chip(c, `a-${i}`))}
              {clientes.map((c, i) => chip(c, `b-${i}`))}
            </div>
            <style>{`@keyframes marquee-home { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-3">
            {clientes.map((c, i) => chip(c, String(i)))}
          </div>
        )}
      </div>
    </section>
  );
}
