interface Props {
  nome: string;
  /** "xs" = 24px, "sm" = 32px, "md" = 40px */
  size?: "xs" | "sm" | "md";
}

function iniciais(nome: string): string {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function colorClass(seed: string): string {
  const palette = [
    "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
    "bg-blue-500/20 text-blue-700 dark:text-blue-300",
    "bg-amber-500/20 text-amber-700 dark:text-amber-300",
    "bg-pink-500/20 text-pink-700 dark:text-pink-300",
    "bg-purple-500/20 text-purple-700 dark:text-purple-300",
    "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300",
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

const SIZE = { xs: "h-6 w-6 text-[10px]", sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm" };

export function ParticipantAvatar({ nome, size = "sm" }: Props) {
  return (
    <div
      className={`${SIZE[size]} ${colorClass(nome)} inline-flex items-center justify-center rounded-full font-semibold ring-2 ring-card`}
      title={nome}
    >
      {iniciais(nome) || "?"}
    </div>
  );
}

export function ParticipantStack({ nomes, max = 4 }: { nomes: string[]; max?: number }) {
  const visiveis = nomes.slice(0, max);
  const overflow = nomes.length - visiveis.length;
  return (
    <div className="flex -space-x-2">
      {visiveis.map((nome, i) => (
        <ParticipantAvatar key={`${nome}-${i}`} nome={nome} size="xs" />
      ))}
      {overflow > 0 && (
        <div className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-card">
          +{overflow}
        </div>
      )}
    </div>
  );
}
