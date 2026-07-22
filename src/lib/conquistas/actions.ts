"use server";

import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { CATALOGO } from "./catalogo";
import { avaliarConquistas } from "./avaliar";
import { getStatsDoUsuario, type StatsUsuario } from "./stats";
import type { ConquistaCard } from "./queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export interface ConquistaNova { key: string; titulo: string }

/**
 * Grava as conquistas recém-desbloqueadas do PRÓPRIO usuário e devolve tanto as
 * novas (pra comemorar com toast) quanto a lista completa de conquistas — tudo a
 * partir de UMA única coleta de stats. Só roda pro próprio (self).
 */
export async function sincronizarConquistasAction(
  userId: string,
  stats?: StatsUsuario,
): Promise<{ novas: ConquistaNova[]; conquistas: ConquistaCard[] }> {
  const actor = await requireAuth();
  if (actor.id !== userId) return { novas: [], conquistas: [] };

  const statsUsados = stats ?? (await getStatsDoUsuario(userId, actor.role));
  const avaliadas = avaliarConquistas(CATALOGO, statsUsados, actor.role).filter((c) => c.aplicavel);
  const desbloqueadas = avaliadas.filter((c) => c.desbloqueada);

  const sb = createServiceRoleClient() as SB;
  const { data: rows } = await sb
    .from("conquista_desbloqueada")
    .select("conquista_key, unlocked_at")
    .eq("user_id", userId);
  const when = new Map(
    ((rows ?? []) as Array<{ conquista_key: string; unlocked_at: string }>).map((r) => [r.conquista_key, r.unlocked_at]),
  );

  const novas = desbloqueadas.filter((c) => !when.has(c.key));
  if (novas.length > 0) {
    await sb
      .from("conquista_desbloqueada")
      .upsert(novas.map((c) => ({ user_id: userId, conquista_key: c.key })), { onConflict: "user_id,conquista_key", ignoreDuplicates: true });
  }

  const agora = new Date().toISOString();
  const conquistas: ConquistaCard[] = avaliadas.map((c) => ({
    ...c,
    unlockedAt: when.get(c.key) ?? (novas.some((n) => n.key === c.key) ? agora : null),
  }));

  return { novas: novas.map((c) => ({ key: c.key, titulo: c.titulo })), conquistas };
}
