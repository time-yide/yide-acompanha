// Módulo puro (sem "use server"/service-role) — pode ser importado por client e
// testado isoladamente. Toda a aritmética de lucro do /produtividade vive aqui.
import { ROLES_ENTREGA_OPERACIONAL } from "@/lib/tarefas/overdue-rules";

/** Cargos fora do cálculo de produtividade (gestão/dona): nem linha, nem denominador. */
export const ROLES_EXCLUIDOS_PRODUTIVIDADE = ["coordenador", "socio"] as const;

/** Produtores do time audiovisual (o coordenador `audiovisual_chefe` NÃO entra —
 *  ele é medido pelo agregado destes). Espelha PRODUCERS de colaboradores/schema. */
export const ROLES_TIME_AUDIOVISUAL = ["videomaker", "fast_midia", "designer", "editor"] as const;

export function isRoleExcluido(role: string | null | undefined): boolean {
  return (ROLES_EXCLUIDOS_PRODUTIVIDADE as readonly string[]).includes(role ?? "");
}

export function isRoleTimeAudiovisual(role: string | null | undefined): boolean {
  return (ROLES_TIME_AUDIOVISUAL as readonly string[]).includes(role ?? "");
}

/**
 * Uma tarefa conta como entrega da pessoa? Operacional (produção) entrega ao
 * chegar em "Concluído operacional" (`concluida`) — e `postada` implica que
 * passou por lá. Demais cargos só entregam em `postada`.
 *
 * Modela SÓ o status de entrega por cargo — NÃO a inclusão na produtividade.
 * `audiovisual_chefe` e `coordenador` estão em `ROLES_ENTREGA_OPERACIONAL` (pra
 * regra de atraso) e portanto retornam `true` aqui. Cabe ao CHAMADOR filtrar
 * gestão/dona antes: `isRoleExcluido(role) || role === "audiovisual_chefe"`
 * (ver getColaboradoresStatus). Não chame isto sem esse pré-filtro.
 */
export function contaComoEntrega(status: string, role: string | null | undefined): boolean {
  const operacional = (ROLES_ENTREGA_OPERACIONAL as readonly string[]).includes(role ?? "");
  if (operacional) return status === "concluida" || status === "postada";
  return status === "postada";
}

/** Faturamento pró-rata do período: (carteira mensal ÷ dias úteis do mês) × dias úteis decorridos. */
export function faturamentoPeriodo(
  carteiraMensal: number,
  diasUteis: number,
  diasUteisMes: number,
): number {
  if (diasUteisMes <= 0) return 0;
  const dias = Math.max(0, diasUteis);
  return Number(((carteiraMensal / diasUteisMes) * dias).toFixed(2));
}

/** Valor de 1 entrega no período. Null se não há entregas ou faturamento. */
export function valorPorEntrega(faturamento: number, totalEntregas: number): number | null {
  if (totalEntregas <= 0 || faturamento <= 0) return null;
  return Number((faturamento / totalEntregas).toFixed(2));
}

/** Receita atribuída a quem fez `entregas` entregas. Null se valor/entrega indefinido. */
export function receitaAtribuida(vpe: number | null, entregas: number): number | null {
  if (vpe === null) return null;
  return Number((vpe * entregas).toFixed(2));
}

/** Lucro = receita − custo. Null se faltar receita ou custo. */
export function lucroPeriodo(receita: number | null, custo: number | null): number | null {
  if (receita === null || custo === null) return null;
  return Number((receita - custo).toFixed(2));
}

export interface ProdutorParaTime {
  receita_periodo: number | null;
  custo_periodo: number | null;
  entregas_periodo: number;
  tempo_ativo_seg_hoje: number;
  tarefas_atrasadas: number;
  capturas_atrasadas: number;
}

export interface TimeAudiovisualAgg {
  receita: number;
  custo: number;
  lucro: number;
  entregas: number;
  tempo_ativo_seg: number;
  atrasados: number;
  produtores: number;
}

/**
 * Agrega o time de produção: receita = Σ receita dos produtores; custo = Σ custo
 * dos produtores + salário do coordenador; lucro = receita − custo. Custo null
 * (sem salário cadastrado) conta como 0.
 */
export function agregarTimeAudiovisual(
  produtores: ProdutorParaTime[],
  coordCusto: number | null,
): TimeAudiovisualAgg {
  const receita = produtores.reduce((a, p) => a + (p.receita_periodo ?? 0), 0);
  const custoProdutores = produtores.reduce((a, p) => a + (p.custo_periodo ?? 0), 0);
  const custo = Number((custoProdutores + (coordCusto ?? 0)).toFixed(2));
  const receitaR = Number(receita.toFixed(2));
  return {
    receita: receitaR,
    custo,
    lucro: Number((receitaR - custo).toFixed(2)),
    entregas: produtores.reduce((a, p) => a + p.entregas_periodo, 0),
    tempo_ativo_seg: produtores.reduce((a, p) => a + p.tempo_ativo_seg_hoje, 0),
    atrasados: produtores.reduce((a, p) => a + p.tarefas_atrasadas + p.capturas_atrasadas, 0),
    produtores: produtores.length,
  };
}
