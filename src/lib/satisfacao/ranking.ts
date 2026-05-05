// SERVER ONLY: do not import from client components
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { SatisfactionColor } from "./schema";

export interface RankingClientFilter {
  assessorId?: string;
  coordenadorId?: string;
}

export interface RankedClient {
  id: string;
  client_id: string;
  semana_iso: string;
  score_final: number;
  cor_final: SatisfactionColor;
  /** "completo" quando todos os avaliadores esperados (assessor + coord) já votaram. */
  status: "em_curso" | "completo";
  /** Quantos avaliaram até agora (entre os esperados). */
  votos_atuais: number;
  /** Quantos avaliadores são esperados pra "completo". */
  votos_esperados: number;
  resumo_ia?: string;
  divergencia_detectada?: boolean;
  acao_sugerida?: string | null;
  created_at?: string;
  cliente: { nome: string; assessor_id: string | null; coordenador_id: string | null } | null;
}

const COR_TO_SCORE: Record<SatisfactionColor, number> = {
  verde: 10,
  amarelo: 5,
  vermelho: 0,
};

function colorFromScore(score: number): SatisfactionColor {
  if (score >= 7.5) return "verde";
  if (score >= 4) return "amarelo";
  return "vermelho";
}

function applyClientFilter<T extends { eq: (col: string, val: string) => T }>(
  query: T,
  filter?: RankingClientFilter,
): T {
  let q = query;
  if (filter?.assessorId) q = q.eq("assessor_id", filter.assessorId);
  if (filter?.coordenadorId) q = q.eq("coordenador_id", filter.coordenadorId);
  return q;
}

/**
 * Calcula o ranking de satisfação de uma semana ISO específica.
 *
 * Combina entries (votos brutos) + synthesis (síntese IA quando existe).
 * - Cliente entra no ranking assim que tem ≥1 voto.
 * - Score: usa síntese quando existe (mais preciso); senão média dos votos.
 * - Status "em_curso" / "completo" sempre computado live a partir de votos
 *   esperados (assessor + coordenador) vs respondidos.
 *
 * Não faz slicing — devolve a lista completa. Use `sliceTopBottom` pra dividir.
 */
export async function computeWeeklyRanking(
  weekIso: string,
  filter?: RankingClientFilter,
): Promise<RankedClient[]> {
  const supabase = createServiceRoleClient();

  let clientsQuery = supabase
    .from("clients")
    .select("id, nome, assessor_id, coordenador_id")
    .eq("status", "ativo");
  clientsQuery = applyClientFilter(clientsQuery as never, filter) as never;
  const { data: clientsData } = await clientsQuery;
  const clients = (clientsData ?? []) as Array<{
    id: string;
    nome: string;
    assessor_id: string | null;
    coordenador_id: string | null;
  }>;
  if (clients.length === 0) return [];

  const clientIds = clients.map((c) => c.id);

  const [entriesRes, synthRes] = await Promise.all([
    supabase
      .from("satisfaction_entries")
      .select("client_id, autor_id, papel_autor, cor")
      .eq("semana_iso", weekIso)
      .in("client_id", clientIds)
      .not("cor", "is", null),
    supabase
      .from("satisfaction_synthesis")
      .select("*")
      .eq("semana_iso", weekIso)
      .in("client_id", clientIds),
  ]);

  const entries = (entriesRes.data ?? []) as Array<{
    client_id: string;
    autor_id: string;
    papel_autor: string;
    cor: SatisfactionColor;
  }>;
  const synthMap = new Map(
    ((synthRes.data ?? []) as Array<{
      id: string;
      client_id: string;
      score_final: number;
      cor_final: SatisfactionColor;
      resumo_ia: string;
      divergencia_detectada: boolean;
      acao_sugerida: string | null;
      created_at: string;
    }>).map((s) => [s.client_id, s]),
  );

  const entriesByClient = new Map<string, Array<{ autor_id: string; papel_autor: string; cor: SatisfactionColor }>>();
  for (const e of entries) {
    const arr = entriesByClient.get(e.client_id) ?? [];
    arr.push({ autor_id: e.autor_id, papel_autor: e.papel_autor, cor: e.cor });
    entriesByClient.set(e.client_id, arr);
  }

  const all: RankedClient[] = [];
  for (const c of clients) {
    const clientEntries = entriesByClient.get(c.id) ?? [];
    if (clientEntries.length === 0) continue;

    const expectedAuthors = [c.assessor_id, c.coordenador_id].filter(
      (x): x is string => x !== null,
    );
    const respondedExpected = expectedAuthors.filter((aid) =>
      clientEntries.some((e) => e.autor_id === aid),
    ).length;
    const status: "em_curso" | "completo" =
      expectedAuthors.length > 0 && respondedExpected >= expectedAuthors.length
        ? "completo"
        : "em_curso";

    const synthesis = synthMap.get(c.id);
    const score = synthesis
      ? Number(synthesis.score_final)
      : clientEntries.reduce((acc, e) => acc + COR_TO_SCORE[e.cor], 0) / clientEntries.length;
    const cor: SatisfactionColor = synthesis
      ? synthesis.cor_final
      : colorFromScore(score);

    all.push({
      id: synthesis?.id ?? `live-${c.id}`,
      client_id: c.id,
      semana_iso: weekIso,
      score_final: Math.round(score * 10) / 10,
      cor_final: cor,
      status,
      votos_atuais: respondedExpected,
      votos_esperados: expectedAuthors.length,
      resumo_ia: synthesis?.resumo_ia,
      divergencia_detectada: synthesis?.divergencia_detectada,
      acao_sugerida: synthesis?.acao_sugerida,
      created_at: synthesis?.created_at,
      cliente: {
        nome: c.nome,
        assessor_id: c.assessor_id,
        coordenador_id: c.coordenador_id,
      },
    });
  }

  return all;
}

/**
 * Divide a lista ranqueada em top 10 mais satisfeitos e top 10 menos satisfeitos.
 *
 * Top: prioriza verde por score desc; quando faltam verdes, preenche com
 * amarelos (próximos do verde) também por score desc.
 * Bottom: vermelhos primeiro por score asc; quando faltam vermelhos, preenche
 * com amarelos (próximos do vermelho) por score asc.
 *
 * Amarelos podem aparecer em ambos os lados se a base tem poucos extremos —
 * comportamento intencional: extremos do amarelo viram "menos pior" e "menos bom".
 */
export function sliceTopBottom(all: RankedClient[]): {
  top: RankedClient[];
  bottom: RankedClient[];
} {
  const verdes = all
    .filter((s) => s.cor_final === "verde")
    .sort((a, b) => Number(b.score_final) - Number(a.score_final));
  const amareloPraTop = all
    .filter((s) => s.cor_final === "amarelo")
    .sort((a, b) => Number(b.score_final) - Number(a.score_final));
  const top = [...verdes, ...amareloPraTop].slice(0, 10);

  const vermelhos = all
    .filter((s) => s.cor_final === "vermelho")
    .sort((a, b) => Number(a.score_final) - Number(b.score_final));
  const amareloPraBottom = all
    .filter((s) => s.cor_final === "amarelo")
    .sort((a, b) => Number(a.score_final) - Number(b.score_final));
  const bottom = [...vermelhos, ...amareloPraBottom].slice(0, 10);

  return { top, bottom };
}
