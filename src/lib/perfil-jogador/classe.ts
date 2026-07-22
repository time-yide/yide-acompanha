import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { calcularTemperamento, ehQuizTemperamento, LETRA_TEMPERAMENTO } from "@/lib/pesquisas/temperamento";
import type { Classe } from "./schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export const CLASSE_DESCRICAO: Record<Classe, string> = {
  Colérico: "Motor de execução: decidido, rápido e focado em resultado.",
  Sanguíneo: "Energia e relação: comunicativo, faz o time andar e engaja.",
  Melancólico: "Qualidade e profundidade: caprichoso, detalhista e planejador.",
  Fleumático: "Calma e estabilidade: paciente, harmonizador e confiável.",
};

/**
 * Temperamento predominante de VÁRIAS pessoas a partir da pesquisa DISC
 * identificada. Resolve a pesquisa DISC UMA vez e busca as respostas de todos
 * os usuários pedidos em uma única query (evita N+1). Todo userId pedido vira
 * chave do Map, com null quando não há quiz DISC ou a pessoa não respondeu.
 */
export async function getTemperamentosDeVarios(userIds: string[]): Promise<Map<string, Classe | null>> {
  const resultado = new Map<string, Classe | null>();
  if (userIds.length === 0) return resultado;
  for (const id of userIds) resultado.set(id, null);

  const sb = createServiceRoleClient() as SB;
  // Acha pesquisas identificadas (não anônimas) e detecta a de temperamento.
  const { data: pesquisas } = await sb
    .from("pesquisas")
    .select("id")
    .eq("anonima", false)
    .is("deleted_at", null);
  let pesquisaId: string | null = null;
  for (const p of (pesquisas ?? []) as Array<{ id: string }>) {
    const { data: perguntas } = await sb
      .from("pesquisa_perguntas")
      .select("tipo, opcoes")
      .eq("pesquisa_id", p.id);
    const lista = (perguntas ?? []) as Array<{ tipo: string; opcoes: string[] | null }>;
    if (lista.length === 0 || !ehQuizTemperamento(lista)) continue;
    pesquisaId = p.id;
    break;
  }
  if (!pesquisaId) return resultado;

  const { data: respostas } = await sb
    .from("pesquisa_respostas")
    .select("user_id, valor")
    .eq("pesquisa_id", pesquisaId)
    .in("user_id", userIds);

  const escolhasPorUser = new Map<string, string[]>();
  for (const r of (respostas ?? []) as Array<{ user_id: string; valor: { escolha?: string } }>) {
    const escolha = r.valor?.escolha;
    if (typeof escolha !== "string") continue;
    const arr = escolhasPorUser.get(r.user_id) ?? [];
    arr.push(escolha);
    escolhasPorUser.set(r.user_id, arr);
  }

  for (const [userId, escolhas] of escolhasPorUser) {
    if (escolhas.length === 0) continue;
    const { predominante } = calcularTemperamento(escolhas);
    if (predominante) resultado.set(userId, LETRA_TEMPERAMENTO[predominante] as Classe);
  }
  return resultado;
}

/**
 * Temperamento predominante de UMA pessoa a partir da pesquisa DISC identificada
 * que ela respondeu. Retorna null se não houver quiz DISC ou ela não respondeu.
 */
export async function getTemperamentoDaPessoa(userId: string): Promise<Classe | null> {
  return (await getTemperamentosDeVarios([userId])).get(userId) ?? null;
}
