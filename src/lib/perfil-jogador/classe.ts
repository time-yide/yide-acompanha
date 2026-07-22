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
 * Temperamento predominante de UMA pessoa a partir da pesquisa DISC identificada
 * que ela respondeu. Retorna null se não houver quiz DISC ou ela não respondeu.
 */
export async function getTemperamentoDaPessoa(userId: string): Promise<Classe | null> {
  const sb = createServiceRoleClient() as SB;
  // Acha pesquisas identificadas (não anônimas) e detecta a de temperamento.
  const { data: pesquisas } = await sb
    .from("pesquisas")
    .select("id")
    .eq("anonima", false)
    .is("deleted_at", null);
  for (const p of (pesquisas ?? []) as Array<{ id: string }>) {
    const { data: perguntas } = await sb
      .from("pesquisa_perguntas")
      .select("tipo, opcoes")
      .eq("pesquisa_id", p.id);
    const lista = (perguntas ?? []) as Array<{ tipo: string; opcoes: string[] | null }>;
    if (lista.length === 0 || !ehQuizTemperamento(lista)) continue;
    const { data: respostas } = await sb
      .from("pesquisa_respostas")
      .select("valor")
      .eq("pesquisa_id", p.id)
      .eq("user_id", userId);
    const escolhas = ((respostas ?? []) as Array<{ valor: { escolha?: string } }>)
      .map((r) => r.valor?.escolha)
      .filter((e): e is string => typeof e === "string");
    if (escolhas.length === 0) continue;
    const { predominante } = calcularTemperamento(escolhas);
    if (predominante) return LETRA_TEMPERAMENTO[predominante] as Classe;
  }
  return null;
}
