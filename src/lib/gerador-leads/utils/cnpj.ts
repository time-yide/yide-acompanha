/**
 * Helpers de formatação e validação de CNPJ (não valida dígitos verificadores —
 * confia no CNPJá; só checa tamanho/formato).
 */

/** Remove pontuação do CNPJ. "12.345.678/0001-90" -> "12345678000190" */
export function stripCnpjFormat(cnpj: string | null | undefined): string | null {
  if (!cnpj) return null;
  return cnpj.replace(/[^\d]/g, "") || null;
}

/** Formata CNPJ pra exibição. "12345678000190" -> "12.345.678/0001-90" */
export function formatCnpj(cnpj: string | null | undefined): string | null {
  if (!cnpj) return null;
  const clean = stripCnpjFormat(cnpj);
  if (!clean || clean.length !== 14) return cnpj; // retorna como veio se tamanho errado
  return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}/${clean.slice(8, 12)}-${clean.slice(12, 14)}`;
}

/** True se string tem o formato de CNPJ (14 dígitos com ou sem máscara). */
export function isValidCnpjFormat(cnpj: string | null | undefined): boolean {
  const clean = stripCnpjFormat(cnpj);
  return clean !== null && clean.length === 14;
}
