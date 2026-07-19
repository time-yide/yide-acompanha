// Helpers puros pra ler campos de FormData (só carrega strings).

/**
 * Interpreta um campo booleano vindo de FormData.
 * Só a string exata "true" vira `true`; qualquer outra coisa vira `false`.
 *
 * IMPORTANTE: NÃO use `z.coerce.boolean()` pra isso — ele faz `Boolean(str)`,
 * e `Boolean("false")` é `true` (string não-vazia). Isso fazia o botão
 * "Despublicar" (que envia "false") re-publicar o post em vez de despublicar.
 */
export function parseBoolCampo(v: FormDataEntryValue | null): boolean {
  return v === "true";
}
