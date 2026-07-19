// Puro/testável — indicadores de CAPACIDADE (aproveitar o time sem contratar):
// carga & folga, trabalho parado (WIP travado), gargalos por setor e concentração.
import { roleParaSetor, type Setor } from "./setor-metricas";

const DIA_MS = 86_400_000;

export interface TarefaAbertaRow {
  atribuido_a: string;
  updated_at: string; // ISO — última mexida (base pra "parado")
}

export interface CapacidadePessoa {
  user_id: string;
  nome: string;
  role: string;
  wip: number;       // tarefas em aberto (carga atual)
  travadas: number;  // WIP sem avançar há > diasParados
  entregues: number; // tarefas concluídas no período (throughput)
}

/**
 * Carga por pessoa: WIP (tarefas abertas atribuídas) + quantas estão "paradas"
 * (sem update há mais de `diasParados`) + entregas do período.
 */
export function agregarCarga(
  abertas: TarefaAbertaRow[],
  pessoas: Array<{ user_id: string; nome: string; role: string }>,
  entreguesByUser: Map<string, number>,
  agoraMs: number,
  diasParados: number,
): CapacidadePessoa[] {
  const wip = new Map<string, number>();
  const travadas = new Map<string, number>();
  const limiteMs = diasParados * DIA_MS;
  for (const t of abertas) {
    if (!t.atribuido_a) continue;
    wip.set(t.atribuido_a, (wip.get(t.atribuido_a) ?? 0) + 1);
    const idade = agoraMs - new Date(t.updated_at).getTime();
    if (Number.isFinite(idade) && idade > limiteMs) {
      travadas.set(t.atribuido_a, (travadas.get(t.atribuido_a) ?? 0) + 1);
    }
  }
  return pessoas
    .map((p) => ({
      user_id: p.user_id,
      nome: p.nome,
      role: p.role,
      wip: wip.get(p.user_id) ?? 0,
      travadas: travadas.get(p.user_id) ?? 0,
      entregues: entreguesByUser.get(p.user_id) ?? 0,
    }))
    .sort((a, b) => b.wip - a.wip || b.entregues - a.entregues);
}

export interface GargaloSetor {
  setor: Setor;
  wip: number;
}

/** WIP somado por setor — a maior fila é o gargalo do time. */
export function agregarGargalos(pessoas: CapacidadePessoa[]): GargaloSetor[] {
  const map = new Map<Setor, number>();
  for (const p of pessoas) {
    const setor = roleParaSetor(p.role);
    if (!setor || p.wip <= 0) continue;
    map.set(setor, (map.get(setor) ?? 0) + p.wip);
  }
  return [...map.entries()]
    .map(([setor, wip]) => ({ setor, wip }))
    .sort((a, b) => b.wip - a.wip);
}

export interface Concentracao {
  total: number;
  topShare: number | null; // % das entregas feito pelo top N
  topNomes: string[];
}

/** Quanto das entregas está concentrado no top N (default 2) — folga do resto. */
export function concentracaoEntregas(pessoas: CapacidadePessoa[], topN = 2): Concentracao {
  const comEntrega = pessoas.filter((p) => p.entregues > 0).sort((a, b) => b.entregues - a.entregues);
  const total = comEntrega.reduce((s, p) => s + p.entregues, 0);
  if (total === 0) return { total: 0, topShare: null, topNomes: [] };
  const top = comEntrega.slice(0, topN);
  const topSoma = top.reduce((s, p) => s + p.entregues, 0);
  return { total, topShare: Math.round((topSoma / total) * 100), topNomes: top.map((p) => p.nome) };
}
