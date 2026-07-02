import { Badge } from "@/components/ui/badge";

/** Rótulos por especialidade. Adicione novas aqui quando surgirem. */
const ESPECIALIDADE_LABEL: Record<string, string> = {
  ecommerce: "E-commerce",
};

export function especialidadeLabel(especialidade: string | null | undefined): string | null {
  if (!especialidade) return null;
  return ESPECIALIDADE_LABEL[especialidade] ?? null;
}

/**
 * Selo de especialidade do assessor (ex.: "E-commerce"). Renderiza `null`
 * quando não há especialidade reconhecida — só rótulo, sem regra de negócio.
 */
export function EspecialidadeBadge({
  especialidade,
  className,
}: {
  especialidade: string | null | undefined;
  className?: string;
}) {
  const label = especialidadeLabel(especialidade);
  if (!label) return null;
  return (
    <Badge
      variant="outline"
      className={
        "border-violet-500/40 text-violet-600 dark:text-violet-300 " + (className ?? "")
      }
    >
      {label}
    </Badge>
  );
}
