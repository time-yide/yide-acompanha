// Skeleton específico das tarefas. Sem ele, a navegação mostrava o loading.tsx
// global (cara de dashboard), que não parece o quadro de tarefas — dava "pulo"
// quando o board real chegava. Este imita header + abas + barra de filtros +
// colunas do quadro, então a troca é suave.

function Skel({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />;
}

export default function TarefasLoading() {
  return (
    <div className="space-y-5">
      {/* Header: título + botões */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <Skel className="h-8 w-32" />
          <Skel className="h-4 w-28" />
        </div>
        <div className="flex items-center gap-2">
          <Skel className="h-9 w-28 rounded-md" />
          <Skel className="h-9 w-32 rounded-md" />
        </div>
      </div>

      {/* Abas */}
      <div className="flex flex-wrap gap-3">
        <Skel className="h-4 w-16" />
        <Skel className="h-4 w-32" />
        <Skel className="h-4 w-28" />
      </div>

      {/* Barra de filtros/toggles */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3">
        <Skel className="h-9 w-40 rounded-md" />
        <Skel className="h-9 w-56 rounded-md" />
      </div>

      {/* Quadro: colunas com cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, col) => (
          <div key={col} className="space-y-2">
            <Skel className="h-5 w-24" />
            {Array.from({ length: (col % 3) + 2 }).map((_, j) => (
              <Skel key={j} className="h-24 opacity-70" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
