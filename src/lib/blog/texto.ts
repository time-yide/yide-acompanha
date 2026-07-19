// Utilitários de texto (puros, testáveis).

/**
 * Remove travessão (—) e meia-risca (–) do texto, trocando por vírgula quando
 * está entre palavras. Rede de segurança pro conteúdo gerado por IA, que não
 * deve usar esses sinais. Não mexe em hífen "-" (usado em listas/markdown).
 */
export function semTravessao(s: string): string {
  return (s || "")
    .replace(/\s*[—–]\s*/g, ", ") // travessão/meia-risca entre espaços vira vírgula
    .replace(/\s*,\s*,/g, ",") // evita vírgula dupla
    .replace(/\s*,\s*([.!?;:])/g, "$1") // evita ", ." e afins
    .replace(/,\s*$/g, ""); // vírgula sobrando no fim
}
