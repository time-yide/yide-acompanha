/**
 * Helpers de comparação fuzzy de nomes — usados pra cruzar nome do sócio
 * da Receita Federal com nomes detectados no site / Instagram.
 */

/**
 * Normaliza nome pra comparação: lowercase, sem acentos, sem espaços duplicados.
 */
export function normalizeName(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove combining marks (acentos)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Similaridade entre dois nomes, 0.0 a 1.0.
 *
 * Estratégia simples e funcional pra nomes BR:
 * 1. Normaliza ambos
 * 2. Tokeniza por espaço, ignora palavras de 1-2 chars (preposições: "da", "de", "do")
 * 3. Combina Jaccard (interseção / união) com overlap coefficient
 *    (interseção / menor dos dois tamanhos), em média.
 *
 * Por que a média: Jaccard puro penaliza demais quando um nome é subconjunto
 * do outro ("João Silva" vs "João da Silva Santos" daria só 0.67). O overlap
 * sozinho é leniente demais ("João" vs "João Pedro Santos" daria 1.0). A média
 * dos dois é robusta pros dois casos comuns em nomes BR (parente com mais/menos
 * sobrenomes vs nomes completamente diferentes).
 */
export function similarity(a: string | null | undefined, b: string | null | undefined): number {
  const normA = normalizeName(a);
  const normB = normalizeName(b);
  if (!normA || !normB) return 0;
  if (normA === normB) return 1;

  const tokensA = new Set(normA.split(" ").filter((t) => t.length >= 3));
  const tokensB = new Set(normB.split(" ").filter((t) => t.length >= 3));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersect = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersect++;
  }
  const union = tokensA.size + tokensB.size - intersect;
  const jaccard = intersect / union;
  const overlap = intersect / Math.min(tokensA.size, tokensB.size);
  return (jaccard + overlap) / 2;
}
