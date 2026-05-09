"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { CapturasList } from "./CapturasList";
import type { CapturaRow } from "@/lib/audiovisual/queries";

interface Editor {
  id: string;
  nome: string;
}

interface Props {
  capturas: CapturaRow[];
  showVideomaker?: boolean;
  editores?: Editor[];
  canDelegate?: boolean;
}

/**
 * Formata o cabeçalho de cada grupo de data:
 * - "Hoje" pra data atual
 * - "Ontem" pra D-1
 * - "DD de mês de YYYY" pra demais
 *
 * dateStr é "YYYY-MM-DD" do data_captacao.
 */
function formatDateHeader(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;

  const date = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.getTime() === today.getTime()) return "Hoje";
  if (date.getTime() === yesterday.getTime()) return "Ontem";

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

/** Agrupa por data_captacao mantendo ordem cronológica (mais recente primeiro). */
function groupByDate(capturas: CapturaRow[]): Array<{ date: string; items: CapturaRow[] }> {
  const map = new Map<string, CapturaRow[]>();
  for (const c of capturas) {
    const list = map.get(c.data_captacao) ?? [];
    list.push(c);
    map.set(c.data_captacao, list);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => (a < b ? 1 : -1)) // descendente
    .map(([date, items]) => ({ date, items }));
}

export function CapturasOrganizadas({
  capturas,
  showVideomaker = false,
  editores = [],
  canDelegate = false,
}: Props) {
  const [showConcluidas, setShowConcluidas] = useState(false);

  const ativas = capturas.filter((c) => !c.concluida_em);
  const concluidas = capturas.filter((c) => c.concluida_em);
  const grupos = groupByDate(ativas);

  return (
    <div className="space-y-6">
      {grupos.length === 0 && concluidas.length === 0 && (
        <p className="rounded-lg border bg-card p-6 text-sm italic text-muted-foreground">
          Nenhuma captação registrada ainda.
        </p>
      )}

      {grupos.map(({ date, items }) => (
        <section key={date} className="space-y-2">
          <div className="flex items-baseline gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/80">
              {formatDateHeader(date)}
            </h3>
            <span className="text-[11px] text-muted-foreground">
              ({items.length} {items.length === 1 ? "captação" : "captações"})
            </span>
          </div>
          <CapturasList
            capturas={items}
            showVideomaker={showVideomaker}
            editores={editores}
            canDelegate={canDelegate}
          />
        </section>
      ))}

      {grupos.length === 0 && concluidas.length > 0 && (
        <p className="rounded-lg border bg-card p-4 text-center text-sm text-muted-foreground">
          Sem captações ativas. Veja as concluídas abaixo.
        </p>
      )}

      {concluidas.length > 0 && (
        <section className="space-y-2">
          <button
            type="button"
            onClick={() => setShowConcluidas((v) => !v)}
            className="flex w-full items-center gap-2 rounded-md border bg-card/50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-foreground/80 transition-colors hover:bg-card"
          >
            {showConcluidas ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            <span>Concluídas</span>
            <span className="text-[11px] font-normal normal-case text-muted-foreground">
              ({concluidas.length})
            </span>
          </button>
          {showConcluidas && (
            <CapturasList
              capturas={concluidas}
              showVideomaker={showVideomaker}
              editores={editores}
              canDelegate={canDelegate}
            />
          )}
        </section>
      )}
    </div>
  );
}
