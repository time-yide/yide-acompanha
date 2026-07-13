// SERVER ONLY: do not import from client components
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { SatisfactionColor } from "./schema";

export interface RankingClientFilter {
  assessorId?: string;
  coordenadorId?: string;
  /** Multi-tenant: filtra clientes pela unidade ativa. */
  unitId?: string | null;
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
  /** Componentes que formaram a média (0-10 cada, null = não entrou). Pra
   * transparência: mostra de onde veio a nota. */
  breakdown?: {
    assessor: number | null;
    coordenador: number | null;
    gravacao: number | null;
  };
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
  if (filter?.unitId) q = q.eq("unit_id", filter.unitId);
  if (filter?.assessorId) q = q.eq("assessor_id", filter.assessorId);
  if (filter?.coordenadorId) q = q.eq("coordenador_id", filter.coordenadorId);
  return q;
}

/**
 * Calcula o ranking de satisfação de uma semana ISO específica.
 *
 * MODELO DA NOTA (média simples das fontes que existirem):
 *  1. Voto do ASSESSOR do cliente na semana (🟢10/🟡5/🔴0).
 *  2. Voto do COORDENADOR do cliente na semana (🟢10/🟡5/🔴0).
 *  3. Nota das GRAVAÇÕES do mês: média das 7 notas (1-5) que o videomaker deu
 *     em cada captura do mês, depois média por cliente, convertida pra 0-10.
 * A nota final é a média simples das fontes presentes. Votos de quem NÃO é o
 * assessor nem o coordenador do cliente não contam.
 *
 * - Cliente entra no ranking se tiver ≥1 fonte (voto do assessor/coord OU
 *   gravação no mês).
 * - Status "completo" = assessor + coordenador do cliente já votaram.
 * - synthesis (IA) não define mais a NOTA (que agora é transparente), mas o
 *   resumo/ação sugerida continuam vindo dela quando existe.
 *
 * Não faz slicing - devolve a lista completa. Use `sliceTopBottom` pra dividir.
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

  // Mês corrente (pra média das gravações). data_captacao é DATE → compara string.
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = now.getFullYear();
  const mo = now.getMonth() + 1;
  const monthStart = `${y}-${pad(mo)}-01`;
  const nextMo = mo === 12 ? 1 : mo + 1;
  const nextY = mo === 12 ? y + 1 : y;
  const monthEnd = `${nextY}-${pad(nextMo)}-01`;

  // audiovisual_capturas ainda não está nos tipos gerados → cast via any.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = supabase as any;
  const [entriesRes, synthRes, capturasRes] = await Promise.all([
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
    sbAny
      .from("audiovisual_capturas")
      .select(
        "client_id, rating_organizacao, rating_facilidade, rating_execucao_roteiro, rating_atrasos, rating_comunicacao, rating_retrabalho, rating_colaboracao",
      )
      .gte("data_captacao", monthStart)
      .lt("data_captacao", monthEnd)
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

  // Nota de gravação por cliente (0-10): média das 7 notas (1-5) de cada
  // captura do mês → média por cliente → escala (avg-1)/4*10 (1=0, 5=10).
  // Capturas com alguma nota faltando são ignoradas.
  const RATING_KEYS = [
    "rating_organizacao", "rating_facilidade", "rating_execucao_roteiro",
    "rating_atrasos", "rating_comunicacao", "rating_retrabalho", "rating_colaboracao",
  ] as const;
  const gravAcc = new Map<string, { soma: number; n: number }>();
  for (const cap of (capturasRes.data ?? []) as Array<
    Record<string, number | null> & { client_id: string }
  >) {
    const vals = RATING_KEYS.map((k) => cap[k]);
    if (vals.some((v) => v === null || v === undefined)) continue;
    const nums = vals as number[];
    const media1a5 = nums.reduce((s, v) => s + v, 0) / nums.length;
    const acc = gravAcc.get(cap.client_id) ?? { soma: 0, n: 0 };
    acc.soma += media1a5;
    acc.n += 1;
    gravAcc.set(cap.client_id, acc);
  }
  const gravScoreByClient = new Map<string, number>();
  for (const [cid, acc] of gravAcc) {
    if (acc.n === 0) continue;
    const media1a5 = acc.soma / acc.n;
    gravScoreByClient.set(cid, ((media1a5 - 1) / 4) * 10);
  }

  // Localiza voto do assessor e do coordenador de cada cliente.
  const entriesByClient = new Map<string, Array<{ autor_id: string; cor: SatisfactionColor }>>();
  for (const e of entries) {
    const arr = entriesByClient.get(e.client_id) ?? [];
    arr.push({ autor_id: e.autor_id, cor: e.cor });
    entriesByClient.set(e.client_id, arr);
  }

  const all: RankedClient[] = [];
  for (const c of clients) {
    const clientEntries = entriesByClient.get(c.id) ?? [];
    const assessorVote = c.assessor_id
      ? clientEntries.find((e) => e.autor_id === c.assessor_id)?.cor
      : undefined;
    const coordVote = c.coordenador_id
      ? clientEntries.find((e) => e.autor_id === c.coordenador_id)?.cor
      : undefined;
    const gravScore = gravScoreByClient.get(c.id) ?? null;

    // Média simples das fontes presentes. Sem nenhuma fonte → fora do ranking.
    const componentes: number[] = [];
    if (assessorVote) componentes.push(COR_TO_SCORE[assessorVote]);
    if (coordVote) componentes.push(COR_TO_SCORE[coordVote]);
    if (gravScore !== null) componentes.push(gravScore);
    if (componentes.length === 0) continue;

    const score = componentes.reduce((s, v) => s + v, 0) / componentes.length;
    const cor = colorFromScore(score);

    const expectedAuthors = [c.assessor_id, c.coordenador_id].filter(
      (x): x is string => x !== null,
    );
    const respondedExpected =
      (c.assessor_id && assessorVote ? 1 : 0) + (c.coordenador_id && coordVote ? 1 : 0);
    const status: "em_curso" | "completo" =
      expectedAuthors.length > 0 && respondedExpected >= expectedAuthors.length
        ? "completo"
        : "em_curso";

    const synthesis = synthMap.get(c.id);
    all.push({
      id: synthesis?.id ?? `live-${c.id}`,
      client_id: c.id,
      semana_iso: weekIso,
      score_final: Math.round(score * 10) / 10,
      cor_final: cor,
      status,
      votos_atuais: (assessorVote ? 1 : 0) + (coordVote ? 1 : 0),
      votos_esperados: expectedAuthors.length,
      resumo_ia: synthesis?.resumo_ia,
      divergencia_detectada: synthesis?.divergencia_detectada,
      acao_sugerida: synthesis?.acao_sugerida,
      created_at: synthesis?.created_at,
      breakdown: {
        assessor: assessorVote ? COR_TO_SCORE[assessorVote] : null,
        coordenador: coordVote ? COR_TO_SCORE[coordVote] : null,
        gravacao: gravScore !== null ? Math.round(gravScore * 10) / 10 : null,
      },
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
 * Amarelos podem aparecer em ambos os lados se a base tem poucos extremos -
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
