interface Props {
  /** small (canto inferior dos slides) ou large (capa central) */
  size?: "small" | "large";
  className?: string;
}

/**
 * Logo Yide pra slides - SVG inline pra não depender de fonte/ícone externo.
 * "Yide Digital" com X estilizado no símbolo lateral.
 */
export function YideLogo({ size = "small", className = "" }: Props) {
  if (size === "large") {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <svg viewBox="0 0 64 64" className="h-12 w-12 text-primary" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 16L48 48M48 16L16 48" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="2" opacity="0.4" />
        </svg>
        <div>
          <div className="text-xl font-bold tracking-tight text-white">YIDE</div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-primary">Digital</div>
        </div>
      </div>
    );
  }
  return (
    <div className={`flex items-center gap-2 opacity-80 ${className}`}>
      <svg viewBox="0 0 64 64" className="h-5 w-5 text-primary" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 16L48 48M48 16L16 48" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      </svg>
      <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">Yide</span>
    </div>
  );
}
