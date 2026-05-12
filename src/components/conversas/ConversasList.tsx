import Link from "next/link";
import { Search, MessageCircle, MoreVertical, Filter } from "lucide-react";
import { ConversaItem } from "./ConversaItem";
import type { ConversaMock } from "@/lib/conversas/mock-data";

interface Props {
  conversas: ConversaMock[];
  conversaSelecionadaId: string | null;
  filtroAtivo: "todas" | "nao_lidas" | "comerciais";
}

const FILTROS = [
  { id: "todas", label: "Todas" },
  { id: "nao_lidas", label: "Não lidas" },
  { id: "comerciais", label: "Comerciais" },
] as const;

/**
 * Sidebar esquerda — search + tabs + lista de conversas.
 * Server Component: navegação por searchParams pra trocar conversa selecionada.
 */
export function ConversasList({ conversas, conversaSelecionadaId, filtroAtivo }: Props) {
  // Fixadas primeiro, depois resto ordenado por última mensagem desc.
  const ordenadas = [...conversas].sort((a, b) => {
    if (a.fixada && !b.fixada) return -1;
    if (!a.fixada && b.fixada) return 1;
    return b.ultima_mensagem_em.localeCompare(a.ultima_mensagem_em);
  });

  return (
    <aside className="flex h-full w-full flex-col border-r bg-card md:max-w-[360px]">
      {/* Header da sidebar */}
      <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-emerald-500" />
          <h2 className="font-semibold">Conversas</h2>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <button
            type="button"
            className="rounded-full p-1.5 hover:bg-muted"
            aria-label="Filtros"
            title="Em breve"
            disabled
          >
            <Filter className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded-full p-1.5 hover:bg-muted"
            aria-label="Mais opções"
            title="Em breve"
            disabled
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Pesquisar ou iniciar nova"
            className="h-9 w-full rounded-full bg-muted/60 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:bg-muted disabled:cursor-not-allowed"
            disabled
            title="Busca em breve"
          />
        </div>
      </div>

      {/* Tabs de filtro */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b">
        {FILTROS.map((f) => (
          <Link
            key={f.id}
            href={f.id === "todas" ? "/conversas" : `/conversas?filtro=${f.id}`}
            scroll={false}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filtroAtivo === f.id
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {/* Lista de conversas */}
      <div className="flex-1 overflow-y-auto">
        {ordenadas.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">
            Nenhuma conversa por aqui.
          </p>
        ) : (
          <div className="divide-y divide-border/60">
            {ordenadas.map((c) => (
              <ConversaItem
                key={c.id}
                conversa={c}
                selecionada={c.id === conversaSelecionadaId}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
