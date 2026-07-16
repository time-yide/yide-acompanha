"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  /** true quando só clientes com postagem estão sendo exibidos (default). */
  soPostagem: boolean;
}

/**
 * Botão que alterna entre "só clientes com postagem" (padrão) e "todos"
 * (inclui tráfego puro). Clientes de tráfego não têm cronograma/design, então
 * poluem a visão geral do painel — por padrão ficam ocultos.
 */
export function PostagemToggle({ soPostagem }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  function toggle() {
    const sp = new URLSearchParams(params.toString());
    // soPostagem é o padrão (sem param). Desligar = incluir tráfego (todos=1).
    if (soPostagem) sp.set("todos", "1");
    else sp.delete("todos");
    router.push(`/painel?${sp.toString()}`);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={soPostagem ? "Mostrando só clientes com postagem — clique pra incluir tráfego" : "Mostrando todos — clique pra ocultar tráfego puro"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
        soPostagem
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      <Check className={cn("h-3.5 w-3.5", !soPostagem && "opacity-0")} />
      Só com postagem
    </button>
  );
}
