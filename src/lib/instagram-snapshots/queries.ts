// src/lib/instagram-snapshots/queries.ts
import "server-only";
import { unstable_noStore as noStore } from "next/cache";
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
  /** Meta mensal de posts. NULL = sem meta (não mostra alerta). */
  meta_posts_mes: number | null;
  ultimo_snapshot: SnapshotRow | null;
  /** Conferência: posts publicados PELO SISTEMA no mês atual (vs Apify). */
  posts_sistema_mes: number;
}

/**
 * Lista clientes elegíveis (pacote yide_360/estrategia/trafego_estrategia) +
 * último snapshot de cada. Filtra por unidade e (opcionalmente) por assessor.
 */
export async function listClientesComUltimoSnapshot(opts: {
  unitId?: string | null;
  assessorId?: string | null;
}): Promise<ClienteComSnapshot[]> {
  // Sem cache: muda de tipo_pacote na ficha do cliente reflete na próxima
  // renderização do dashboard sem precisar esperar revalidação automática.
  noStore();
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  let q = sb
    .from("clients")
    .select("id, nome, tipo_pacote, instagram_url, assessor_id, unit_id, pacote_post_padrao")
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
    pacote_post_padrao: number | null;
  }>;

  if (rows.length === 0) return [];

  const clienteIds = rows.map((r) => r.id);
  const assessorIds = Array.from(
    new Set(rows.map((r) => r.assessor_id).filter((id): id is string => !!id)),
  );
  // Início do mês atual em Cuiabá (UTC-4) — cálculo sem IO, feito antes das queries.
  const agora = new Date();
  const cuiaba = new Date(agora.getTime() - 4 * 60 * 60 * 1000);
  const inicioMesIso = new Date(
    Date.UTC(cuiaba.getUTCFullYear(), cuiaba.getUTCMonth(), 1, 4, 0, 0),
  ).toISOString();

  // As 3 queries seguintes só dependem dos ids da query de clients e são
  // independentes entre si — rodam em PARALELO (antes eram 3 idas sequenciais):
  // 1) último snapshot por cliente  2) nome dos assessores  3) conferência de posts do sistema.
  const [snaps, profs, smPosts] = await Promise.all([
    sb
      .from("client_instagram_snapshots")
      .select("*")
      .in("client_id", clienteIds)
      .order("client_id")
      .order("scraped_at", { ascending: false })
      .then((r: { data: SnapshotRow[] | null }) => r.data ?? []),
    assessorIds.length > 0
      ? sb
          .from("profiles")
          .select("id, nome")
          .in("id", assessorIds)
          .then((r: { data: Array<{ id: string; nome: string }> | null }) => r.data ?? [])
      : Promise.resolve([] as Array<{ id: string; nome: string }>),
    // Conferência: tabela pode não existir → catch devolve [] sem quebrar o dashboard.
    sb
      .from("social_media_posts")
      .select("client_id")
      .in("client_id", clienteIds)
      .eq("status", "publicado")
      .is("archived_at", null)
      .gte("publicado_em", inicioMesIso)
      .then((r: { data: Array<{ client_id: string }> | null }) => r.data ?? [])
      .catch(() => [] as Array<{ client_id: string }>),
  ]);

  // Último snapshot por cliente (já vem ordenado por scraped_at desc).
  const ultimoPorCliente = new Map<string, SnapshotRow>();
  for (const s of snaps as SnapshotRow[]) {
    if (!ultimoPorCliente.has(s.client_id)) {
      ultimoPorCliente.set(s.client_id, s);
    }
  }

  const nomesAssessor = new Map<string, string>();
  for (const p of profs as Array<{ id: string; nome: string }>) {
    nomesAssessor.set(p.id, p.nome);
  }

  const postsSistemaPorCliente = new Map<string, number>();
  for (const p of smPosts as Array<{ client_id: string }>) {
    postsSistemaPorCliente.set(p.client_id, (postsSistemaPorCliente.get(p.client_id) ?? 0) + 1);
  }

  return rows.map((c) => ({
    cliente_id: c.id,
    cliente_nome: c.nome,
    tipo_pacote: c.tipo_pacote,
    instagram_url: c.instagram_url,
    assessor_id: c.assessor_id,
    assessor_nome: c.assessor_id ? (nomesAssessor.get(c.assessor_id) ?? null) : null,
    unit_id: c.unit_id,
    meta_posts_mes: c.pacote_post_padrao,
    ultimo_snapshot: ultimoPorCliente.get(c.id) ?? null,
    posts_sistema_mes: postsSistemaPorCliente.get(c.id) ?? 0,
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
