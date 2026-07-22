import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { CATALOGO } from "./catalogo";
import { avaliarConquistas, type ConquistaAvaliada } from "./avaliar";
import { getStatsDoUsuario } from "./stats";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export interface ConquistaCard extends ConquistaAvaliada {
  unlockedAt: string | null;
}

/** Lista as conquistas aplicáveis do usuário, já cruzadas com o que está gravado. */
export async function getConquistasDoUsuario(userId: string, role: string): Promise<ConquistaCard[]> {
  const stats = await getStatsDoUsuario(userId, role);
  const avaliadas = avaliarConquistas(CATALOGO, stats, role).filter((c) => c.aplicavel);

  const sb = createServiceRoleClient() as SB;
  const { data: rows } = await sb
    .from("conquista_desbloqueada")
    .select("conquista_key, unlocked_at")
    .eq("user_id", userId);
  const when = new Map(
    ((rows ?? []) as Array<{ conquista_key: string; unlocked_at: string }>).map((r) => [r.conquista_key, r.unlocked_at]),
  );

  return avaliadas.map((c) => ({ ...c, unlockedAt: when.get(c.key) ?? null }));
}
