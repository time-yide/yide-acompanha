import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * @supabase/ssr (cookie-based auth) NÃO injeta o JWT no websocket de
 * Realtime automaticamente. Sem isso, o canal de postgres_changes faz
 * handshake como anônimo, RLS dropa todos os eventos silenciosamente
 * e o subscriber não recebe nada.
 *
 * Este util:
 * 1. Pega o access_token da sessão atual e seta no realtime client
 * 2. Listenear onAuthStateChange pra reaplicar quando o token renovar
 *
 * Retorna uma função pra dar unsubscribe da listener (idealmente chamada
 * no cleanup do useEffect).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function authenticateRealtime(supabase: SupabaseClient<any, any, any>): Promise<() => void> {
  const { data } = await supabase.auth.getSession();
  if (data.session?.access_token) {
    supabase.realtime.setAuth(data.session.access_token);
  }
  const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.access_token) {
      supabase.realtime.setAuth(session.access_token);
    }
  });
  return () => sub.subscription.unsubscribe();
}
