"use client";

import { useMemo, useState } from "react";
import { Circle, ArrowUp, ArrowDown, Trophy, AlertTriangle, Video } from "lucide-react";
import type { ColaboradorStatusRow } from "@/lib/produtividade/queries";
import { formatHours, formatBRL } from "./ProdutividadeSummaryCards";
import { roleLabel } from "@/lib/auth/permissions";

interface Props {
  rows: ColaboradorStatusRow[];
}

type SortKey = "nome" | "ativo" | "tempo" | "eventos" | "custo_periodo" | "custo_hora" | "atrasados" | "entregas" | "receita" | "lucro";
type SortDir = "asc" | "desc";

function StatusDot({ online, ativo }: { online: boolean; ativo: boolean }) {
  const color = ativo
    ? "text-emerald-500"
    : online
      ? "text-amber-500"
      : "text-muted-foreground/40";
  const label = ativo ? "Ativo" : online ? "Online" : "Offline";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <Circle className={`h-2 w-2 fill-current ${color}`} />
      <span className={ativo || online ? "" : "text-muted-foreground"}>{label}</span>
    </span>
  );
}

export function ColaboradoresTable({ rows }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("tempo");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const list = [...rows];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "nome":
          cmp = a.nome.localeCompare(b.nome, "pt-BR");
          break;
        case "ativo":
          cmp =
            Number(b.ativo) - Number(a.ativo) ||
            Number(b.online) - Number(a.online);
          break;
        case "tempo":
          cmp = b.tempo_ativo_seg_hoje - a.tempo_ativo_seg_hoje;
          break;
        case "eventos":
          cmp = b.eventos_hoje - a.eventos_hoje;
          break;
        case "custo_periodo":
          cmp = (b.custo_periodo ?? 0) - (a.custo_periodo ?? 0);
          break;
        case "custo_hora":
          cmp = (b.custo_hora ?? 0) - (a.custo_hora ?? 0);
          break;
        case "atrasados":
          cmp =
            (b.tarefas_atrasadas + b.capturas_atrasadas) -
            (a.tarefas_atrasadas + a.capturas_atrasadas);
          break;
        case "entregas":
          cmp = b.entregas_periodo - a.entregas_periodo;
          break;
        case "receita":
          cmp = (b.receita_periodo ?? 0) - (a.receita_periodo ?? 0);
          break;
        case "lucro":
          cmp = (b.lucro_periodo ?? 0) - (a.lucro_periodo ?? 0);
          break;
      }
      return sortDir === "asc" ? -cmp : cmp;
    });
    return list;
  }, [rows, sortKey, sortDir]);

  // Identifica top 3 em tempo ativo (mostra troféu)
  const topByTime = useMemo(() => {
    return [...rows]
      .sort((a, b) => b.tempo_ativo_seg_hoje - a.tempo_ativo_seg_hoje)
      .filter((r) => r.tempo_ativo_seg_hoje > 0)
      .slice(0, 3)
      .map((r) => r.user_id);
  }, [rows]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("desc");
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 text-left">
                <SortBtn label="Colaborador" k="nome" sortKey={sortKey} sortDir={sortDir} toggle={toggleSort} />
              </th>
              <th className="px-4 py-2.5 text-left">
                <SortBtn label="Status" k="ativo" sortKey={sortKey} sortDir={sortDir} toggle={toggleSort} />
              </th>
              <th className="px-4 py-2.5 text-right">
                <SortBtn label="Tempo ativo" k="tempo" sortKey={sortKey} sortDir={sortDir} toggle={toggleSort} />
              </th>
              <th className="px-4 py-2.5 text-right">
                <SortBtn label="Eventos" k="eventos" sortKey={sortKey} sortDir={sortDir} toggle={toggleSort} />
              </th>
              <th className="px-4 py-2.5 text-right">
                <SortBtn label="Atrasados" k="atrasados" sortKey={sortKey} sortDir={sortDir} toggle={toggleSort} />
              </th>
              <th className="px-4 py-2.5 text-right">
                <SortBtn label="Custo/h" k="custo_hora" sortKey={sortKey} sortDir={sortDir} toggle={toggleSort} />
              </th>
              <th
                className="px-4 py-2.5 text-right"
                title="Salário fixo no período: (salário mensal ÷ 22 dias úteis) × dias úteis decorridos. É o que se paga, independente de atividade."
              >
                <SortBtn label="Custo salário" k="custo_periodo" sortKey={sortKey} sortDir={sortDir} toggle={toggleSort} />
              </th>
              <th
                className="px-4 py-2.5 text-right"
                title="Entregas no período (tarefas postadas). Abaixo: quanto de salário fixo cada entrega custou."
              >
                <SortBtn label="Entregas" k="entregas" sortKey={sortKey} sortDir={sortDir} toggle={toggleSort} />
              </th>
              <th
                className="px-4 py-2.5 text-right"
                title="Receita atribuída: valor médio por entrega × entregas da pessoa."
              >
                <SortBtn label="Receita" k="receita" sortKey={sortKey} sortDir={sortDir} toggle={toggleSort} />
              </th>
              <th
                className="px-4 py-2.5 text-right"
                title="Lucro no período: receita atribuída − custo do salário."
              >
                <SortBtn label="Lucro" k="lucro" sortKey={sortKey} sortDir={sortDir} toggle={toggleSort} />
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const rank = topByTime.indexOf(r.user_id);
              return (
                <tr key={r.user_id} className="border-b last:border-b-0 hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {rank >= 0 && (
                        <Trophy
                          className={`h-3.5 w-3.5 flex-shrink-0 ${
                            rank === 0
                              ? "text-amber-500"
                              : rank === 1
                                ? "text-gray-400"
                                : "text-amber-700"
                          }`}
                        />
                      )}
                      <div className="min-w-0">
                        <div className="truncate font-medium">{r.nome}</div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {roleLabel(r.role)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusDot online={r.online} ativo={r.ativo} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.tempo_ativo_seg_hoje > 0 ? (
                      <div className="flex flex-col items-end leading-tight">
                        <span>{formatHours(r.tempo_ativo_seg_hoje)}</span>
                        {r.tempo_externo_seg_hoje > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-fuchsia-600 dark:text-fuchsia-400">
                            <Video className="h-2.5 w-2.5" />
                            {formatHours(r.tempo_externo_seg_hoje)} em captação
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground/50">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.eventos_hoje > 0 ? r.eventos_hoje : <span className="text-muted-foreground/50">-</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <AtrasadosBadge tarefas={r.tarefas_atrasadas} capturas={r.capturas_atrasadas} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-xs text-muted-foreground">
                    {r.custo_hora !== null
                      ? formatBRL(r.custo_hora)
                      : <span className="text-muted-foreground/50">-</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">
                    {r.custo_periodo !== null && r.custo_periodo > 0
                      ? formatBRL(r.custo_periodo)
                      : <span className="text-muted-foreground/50">-</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <EntregasCell
                      entregas={r.entregas_periodo}
                      custoPorEntrega={r.custo_por_entrega}
                    />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-xs text-muted-foreground">
                    {r.receita_periodo !== null
                      ? formatBRL(r.receita_periodo)
                      : <span className="text-muted-foreground/50">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">
                    {r.lucro_periodo !== null ? (
                      <span className={r.lucro_periodo >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                        {formatBRL(r.lucro_periodo)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SortBtn({
  label,
  k,
  sortKey,
  sortDir,
  toggle,
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  toggle: (k: SortKey) => void;
}) {
  const active = sortKey === k;
  return (
    <button
      type="button"
      onClick={() => toggle(k)}
      className={`inline-flex items-center gap-1 ${active ? "text-foreground" : "hover:text-foreground"}`}
    >
      {label}
      {active && (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
    </button>
  );
}

function EntregasCell({
  entregas,
  custoPorEntrega,
}: {
  entregas: number;
  custoPorEntrega: number | null;
}) {
  if (entregas === 0) {
    return <span className="text-muted-foreground/50">-</span>;
  }
  return (
    <div className="flex flex-col items-end leading-tight">
      <span className="font-semibold">{entregas}</span>
      {custoPorEntrega !== null && (
        <span
          className="text-[10px] text-muted-foreground"
          title="Custo de salário fixo por entrega no período"
        >
          {formatBRL(custoPorEntrega)}/entrega
        </span>
      )}
    </div>
  );
}

function AtrasadosBadge({ tarefas, capturas }: { tarefas: number; capturas: number }) {
  const total = tarefas + capturas;
  if (total === 0) {
    return <span className="text-muted-foreground/50">-</span>;
  }
  const parts: string[] = [];
  if (tarefas > 0) parts.push(`${tarefas} tarefa${tarefas === 1 ? "" : "s"}`);
  if (capturas > 0) parts.push(`${capturas} captura${capturas === 1 ? "" : "s"}`);
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-700 dark:text-rose-300"
      title={parts.join(" · ")}
    >
      <AlertTriangle className="h-3 w-3" />
      {total}
    </span>
  );
}
