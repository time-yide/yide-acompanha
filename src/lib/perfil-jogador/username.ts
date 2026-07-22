/** Normaliza pra comparação/armazenamento: lower, sem @, sem espaços nas pontas. */
export function normalizarUsername(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

/** Devolve mensagem de erro ou null se válido. Espera valor já normalizado ou cru. */
export function validarUsername(raw: string): string | null {
  const u = normalizarUsername(raw);
  if (u.length < 3 || u.length > 20) return "Use de 3 a 20 caracteres.";
  if (!/^[a-z0-9_.]+$/.test(u)) return "Só letras, números, ponto e underline.";
  return null;
}
