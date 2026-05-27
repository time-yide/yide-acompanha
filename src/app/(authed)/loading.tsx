// Fallback enquanto a page segment carrega. Cobre a janela entre o layout
// authed terminar (queries de badges, unit context) e o page renderizar —
// em mobile com 4G isso pode dar 300-800ms de tela em branco sem este file.
//
// Skeleton genérico: header + bloco de KPIs + bloco grande. Cada page
// pode ter um loading.tsx próprio mais específico (ex: /onboarding,
// /escritorio, /prospeccao já tem).

function Skel({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />;
}

export default function Loading() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <header className="space-y-2">
        <Skel className="h-7 w-48" />
        <Skel className="h-4 w-64" />
      </header>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skel key={i} className="h-20 sm:h-24" />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skel className="h-48 sm:h-64" />
        <Skel className="h-48 sm:h-64" />
      </div>

      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skel key={i} className="h-10" />
        ))}
      </div>
    </div>
  );
}
