// Skeleton específico do calendário. Sem este arquivo, a navegação mostrava o
// loading.tsx global (cara de dashboard: KPIs + blocos), que não parece nada
// com um calendário — quando a grade real chegava, dava um "pulo" feio. Este
// esqueleto imita header + chips + grade semanal, então a troca é suave e a
// tela FEELS carregando certo desde o primeiro byte.

function Skel({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />;
}

export default function CalendarioLoading() {
  return (
    <div className="space-y-5">
      {/* Header: título/subtítulo + navegação */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <Skel className="h-7 w-48" />
          <Skel className="h-4 w-56" />
        </div>
        <div className="flex items-center gap-2">
          <Skel className="h-9 w-9 rounded-md" />
          <Skel className="h-9 w-20 rounded-md" />
          <Skel className="h-9 w-9 rounded-md" />
        </div>
      </div>

      {/* Chips das sub-agendas */}
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skel key={i} className="h-7 w-24 rounded-full" />
        ))}
      </div>

      {/* Grade semanal: 7 colunas (cabeçalho de dia + eventos) */}
      <div className="overflow-hidden rounded-lg border">
        <div className="grid grid-cols-7 border-b bg-muted/30">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="border-r p-2 last:border-r-0">
              <Skel className="mx-auto h-4 w-12" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: 7 }).map((_, col) => (
            <div key={col} className="min-h-[55vh] space-y-2 border-r p-2 last:border-r-0">
              {Array.from({ length: (col % 3) + 1 }).map((_, j) => (
                <Skel key={j} className="h-12 opacity-70" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
