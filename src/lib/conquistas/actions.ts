"use server";

import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { CATALOGO } from "./catalogo";
import { avaliarConquistas } from "./avaliar";
import { getStatsDoUsuario } from "./stats";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export interface ConquistaNova { key: string; titulo: string }

/**
 * Grava as conquistas recém-desbloqueadas do PRÓPRIO usuário e devolve as novas
 * (pra comemorar com toast). Só roda pro próprio (self).
 */
export async function sincronizarConquistasAction(userId: string): Promise<ConquistaNova[]> {
  const actor = await requireAuth();
  if (actor.id !== userId) return [];

  const stats = await getStatsDoUsuario(userId, actor.role);
  const desbloqueadas = avaliarConquistas(CATALOGO, stats, actor.role)
    .filter((c) => c.aplicavel && c.desbloqueada);

  const sb = createServiceRoleClient() as SB;
  const { data: rows } = await sb
    .from("conquista_desbloqueada")
    .select("conquista_key")
    .eq("user_id", userId);
  const jaTem = new Set(((rows ?? []) as Array<{ conquista_key: string }>).map((r) => r.conquista_key));

  const novas = desbloqueadas.filter((c) => !jaTem.has(c.key));
  if (novas.length > 0) {
    await sb
      .from("conquista_desbloqueada")
      .upsert(novas.map((c) => ({ user_id: userId, conquista_key: c.key })), { onConflict: "user_id,conquista_key", ignoreDuplicates: true });
  }
  return novas.map((c) => ({ key: c.key, titulo: c.titulo }));
}
