// src/lib/instagram-snapshots/queries.ts
import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { SnapshotRow, PostRecente } from "./tipos";
import { PACOTES_ELEGIVEIS } from "./tipos";

export interface ClienteComSnapshot {
  cliente_id: string;
  cliente_nome: string;
  tipo_pacote: string;
  instagram_url: string | null;
  assessor_id: string | null;
  assessor_nome: string | null;
  unit_id: string | null;
  ultimo_snapshot: SnapshotRow | null;
}

/**
 * Lista clientes elegíveis (pacote yide_360/estrategia/trafego_estrategia) +
 * último snapshot de cada. Filtra por unidade e (opcionalmente) por assessor.
 */
export async function listClientesComUltimoSnapshot(opts: {
  unitId?: string | null;
  assessorId?: string | null;
}): Promise<ClienteComSnapshot[]> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  let q = sb
    .from("clients")
    .select("id, nome, tipo_pacote, instagram_url, assessor_id, unit_id")
    .eq("status", "ativo")
    .in("tipo_pacote", PACOTES_ELEGIVEIS as readonly string[])
    .is("deleted_at", null);

  if (opts.unitId) q = q.eq("unit_id", opts.unitId);
  if (opts.assessorId) q = q.eq("assessor_id", opts.assessorId);

  const { data: clientes } = await q.order("nome");
  const rows = (clientes ?? []) as Array<{
    id: string;
    nome: string;
    tipo_pacote: string;
    instagram_url: string | null;
    assessor_id: string | null;
    unit_id: string | null;
  }>;

  if (rows.length === 0) return [];

  // Busca último snapshot por cliente. Mantém só o primeiro de cada client_id
  // (já vem ordenado por scraped_at desc).
  const clienteIds = rows.map((r) => r.id);
  const { data: snaps } = await sb
    .from("client_instagram_snapshots")
    .select("*")
    .in("client_id", clienteIds)
    .order("client_id")
    .order("scraped_at", { ascending: false });

  const ultimoPorCliente = new Map<string, SnapshotRow>();
  for (const s of (snaps ?? []) as SnapshotRow[]) {
    if (!ultimoPorCliente.has(s.client_id)) {
      ultimoPorCliente.set(s.client_id, s);
    }
  }

  // Resolve nome dos assessores em UMA query.
  const assessorIds = Array.from(
    new Set(rows.map((r) => r.assessor_id).filter((id): id is string => !!id)),
  );
  const nomesAssessor = new Map<string, string>();
  if (assessorIds.length > 0) {
    const { data: profs } = await sb
      .from("profiles")
      .select("id, nome")
      .in("id", assessorIds);
    for (const p of ((profs ?? []) as Array<{ id: string; nome: string }>)) {
      nomesAssessor.set(p.id, p.nome);
    }
  }

  return rows.map((c) => ({
    cliente_id: c.id,
    cliente_nome: c.nome,
    tipo_pacote: c.tipo_pacote,
    instagram_url: c.instagram_url,
    assessor_id: c.assessor_id,
    assessor_nome: c.assessor_id ? (nomesAssessor.get(c.assessor_id) ?? null) : null,
    unit_id: c.unit_id,
    ultimo_snapshot: ultimoPorCliente.get(c.id) ?? null,
  }));
}

/**
 * Retorna se o cliente tem snapshot recente o suficiente pra dispensar
 * chamar Apify de novo. Usado pra cache de 1h/5min.
 */
export async function getSnapshotSeRecente(
  clienteId: string,
  maxAgeMs: number,
): Promise<SnapshotRow | null> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const cutoff = new Date(Date.now() - maxAgeMs).toISOString();
  const { data } = await sb
    .from("client_instagram_snapshots")
    .select("*")
    .eq("client_id", clienteId)
    .eq("scrape_status", "ok")
    .gte("scraped_at", cutoff)
    .order("scraped_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as SnapshotRow | null) ?? null;
}

/** Lista clientes elegíveis pro cron (passou pela elegibilidade + tem URL). */
export async function listClientesParaCron(): Promise<Array<{
  id: string;
  organization_id: string;
  instagram_url: string;
}>> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data } = await sb
    .from("clients")
    .select("id, organization_id, instagram_url")
    .eq("status", "ativo")
    .in("tipo_pacote", PACOTES_ELEGIVEIS as readonly string[])
    .not("instagram_url", "is", null)
    .is("deleted_at", null);
  return ((data ?? []) as Array<{
    id: string;
    organization_id: string;
    instagram_url: string;
  }>).filter((c) => c.instagram_url && c.instagram_url.trim().length > 0);
}

// Re-export pra usar no cliente quando precisar (parsing JSON do snapshot)
export type { PostRecente, SnapshotRow };
