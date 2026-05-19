import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { Database } from "@/types/database";

type Status = Database["public"]["Enums"]["snapshot_status"];

async function _listSnapshotsForUserImpl(userId: string, limit: number) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("commission_snapshots")
    .select("*")
    .eq("user_id", userId)
    .order("mes_referencia", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function listSnapshotsForUser(userId: string, limit = 12) {
  const cached = unstable_cache(
    async (paramsJson: string) => {
      const { uid, l } = JSON.parse(paramsJson) as { uid: string; l: number };
      return _listSnapshotsForUserImpl(uid, l);
    },
    ["comissoes-snapshots-user"],
    { revalidate: 60, tags: ["commissions"] },
  );
  return cached(JSON.stringify({ uid: userId, l: limit }));
}

export async function getSnapshotById(id: string) {
  // Não cacheado: detalhe específico, raramente revisitado, mais simples assim.
  const supabase = await createClient();
  const { data: snap, error } = await supabase
    .from("commission_snapshots")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  const { data: items } = await supabase
    .from("commission_snapshot_items")
    .select("*")
    .eq("snapshot_id", id);
  return { snapshot: snap, items: items ?? [] };
}

async function _listSnapshotsForMonthImpl(monthRef: string, unitProfileIds: string[] | null) {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase
    .from("commission_snapshots")
    .select("*, profile:profiles!commission_snapshots_user_id_fkey(id, nome, role, avatar_url)")
    .eq("mes_referencia", monthRef)
    .order("user_id");

  // Multi-tenant: filtra snapshots dos users da unidade ativa
  if (unitProfileIds !== null) {
    if (unitProfileIds.length === 0) return [];
    q = q.in("user_id", unitProfileIds);
  }

  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function listSnapshotsForMonth(monthRef: string, unitProfileIds: string[] | null = null) {
  const cached = unstable_cache(
    async (m: string, idsJson: string) => {
      const ids = idsJson === "null" ? null : (JSON.parse(idsJson) as string[]);
      return _listSnapshotsForMonthImpl(m, ids);
    },
    // v2: filtra por unitProfileIds (multi-tenant — prolábore por unidade)
    ["comissoes-snapshots-month-v2"],
    { revalidate: 60, tags: ["commissions"] },
  );
  return cached(monthRef, unitProfileIds === null ? "null" : JSON.stringify(unitProfileIds));
}

async function _getMonthsAwaitingApprovalImpl(): Promise<string[]> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("commission_snapshots")
    .select("mes_referencia")
    .eq("status", "pending_approval" as Status);
  const set = new Set<string>();
  for (const r of (data ?? []) as Array<{ mes_referencia: string }>) {
    set.add(r.mes_referencia);
  }
  return [...set].sort();
}

export async function getMonthsAwaitingApproval(): Promise<string[]> {
  const cached = unstable_cache(
    async () => _getMonthsAwaitingApprovalImpl(),
    ["comissoes-months-awaiting"],
    { revalidate: 60, tags: ["commissions"] },
  );
  return cached();
}
