import Link from "next/link";
import { ChevronLeft, BookOpen } from "lucide-react";

interface Props {
  current: string;
}

/**
 * Voltar pra index do manual + breadcrumb. Renderiza no topo de cada
 * sub-página (/manual/materiais, /manual/regras-da-casa, etc.).
 */
export function ManualBreadcrumb({ current }: Props) {
  return (
    <nav className="flex items-center gap-2 text-xs text-muted-foreground">
      <Link href="/manual" className="inline-flex items-center gap-1 hover:text-foreground">
        <ChevronLeft className="h-3 w-3" />
        <BookOpen className="h-3 w-3" />
        Bastidores
      </Link>
      <span>/</span>
      <span className="font-medium text-foreground">{current}</span>
    </nav>
  );
}
