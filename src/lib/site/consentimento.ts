// Consentimento de cookies do site público (LGPD). Sem resposta = tudo negado: o Google
// mede só de forma agregada (Modo de Consentimento) e os pixels de terceiros não carregam.
export type Consentimento = "aceito" | "essencial";
export const CHAVE_CONSENTIMENTO = "yide_consentimento_v1";
export const EVENTO_CONSENTIMENTO = "yide:consentimento";

export function lerConsentimento(valor: string | null): Consentimento | null {
  return valor === "aceito" || valor === "essencial" ? valor : null;
}

export function sinaisConsentimento(c: Consentimento | null) {
  const v = c === "aceito" ? "granted" : "denied";
  return { ad_storage: v, ad_user_data: v, ad_personalization: v, analytics_storage: v };
}
