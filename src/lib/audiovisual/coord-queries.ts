// SERVER ONLY
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface PendingDelegationRow {
  id: string;
  titulo: string;
  inicio: string;
  fim: string;
  client_id: string | null;
  cliente_nome: string | null;
  localizacao_endereco: string | null;
  localizacao_maps_url: string | null;
  link_roteiro: string | null;
  observacoes_gravacao: string | null;
  criado_por: string;
  criador_nome: string | null;
  created_at: string;
}

/**
 * Lista eventos de videomaker em status pending_delegation — fila do
 * coord audiovisual. Ordena por data de captação (mais próximos primeiro).
 *
 * `unitClientIds`: filtro multi-tenant.
 *   - null = sem filtro (master vendo "todas" ou migration não rodada)
 *   - [] = unidade nova sem clientes → retorna vazio
 *   - [ids] = só captações de clientes dessa unidade (ou sem client_id)
 */
export async function listPendingDelegations(
  unitClientIds: string[] | null = null,
): Promise<PendingDelegationRow[]> {
  if (unitClientIds !== null && unitClientIds.length === 0) return [];

  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = sb
    .from("calendar_events")
    .select(`
      id, titulo, inicio, fim, client_id, criado_por, created_at,
      localizacao_endereco, localizacao_maps_url, link_roteiro, observacoes_gravacao,
      cliente:clients(nome),
      criador:profiles!calendar_events_criado_por_fkey(nome)
    `)
    .eq("sub_calendar", "videomakers")
    .eq("videomaker_status", "pending_delegation");

  if (unitClientIds !== null) {
    // Captações sem client_id (raro, mas existe) seguem visíveis pra todos —
    // a coluna `client_id` é nullable e nem todo evento de videomaker tem
    // cliente vinculado.
    q = q.or(`client_id.in.(${unitClientIds.join(",")}),client_id.is.null`);
  }

  const { data, error } = await q.order("inicio", { ascending: true });

  if (error) {
    console.error("[audiovisual/coord] listPendingDelegations failed:", error);
    return [];
  }

  const rows = (data ?? []) as Array<{
    id: string;
    titulo: string;
    inicio: string;
    fim: string;
    client_id: string | null;
    criado_por: string;
    created_at: string;
    localizacao_endereco: string | null;
    localizacao_maps_url: string | null;
    link_roteiro: string | null;
    observacoes_gravacao: string | null;
    cliente?: { nome: string } | null;
    criador?: { nome: string } | null;
  }>;

  return rows.map((r) => ({
    id: r.id,
    titulo: r.titulo,
    inicio: r.inicio,
    fim: r.fim,
    client_id: r.client_id,
    cliente_nome: r.cliente?.nome ?? null,
    localizacao_endereco: r.localizacao_endereco,
    localizacao_maps_url: r.localizacao_maps_url,
    link_roteiro: r.link_roteiro,
    observacoes_gravacao: r.observacoes_gravacao,
    criado_por: r.criado_por,
    criador_nome: r.criador?.nome ?? null,
    created_at: r.created_at,
  }));
}

export interface VideomakerOption {
  id: string;
  nome: string;
}

/** Lista videomakers ativos pra dropdown da delegação. */
export async function listVideomakersAtivos(): Promise<VideomakerOption[]> {
  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;
  const { data } = await sb
    .from("profiles")
    .select("id, nome")
    .eq("role", "videomaker")
    .eq("ativo", true)
    .order("nome");
  return (data ?? []) as VideomakerOption[];
}

export interface ScheduledRowForVideomaker {
  id: string;
  inicio: string;
  fim: string;
  titulo: string;
}

/**
 * Pra cada videomaker, retorna seus eventos AGENDADOS num range. Usado
 * pra avisar visualmente "esse videomaker já tem 2 captações no dia"
 * antes do coord clicar em delegar.
 */
export async function listScheduledByVideomaker(
  videomakerIds: string[],
  windowDays = 14,
): Promise<Map<string, ScheduledRowForVideomaker[]>> {
  const out = new Map<string, ScheduledRowForVideomaker[]>();
  if (videomakerIds.length === 0) return out;

  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const until = new Date(Date.now() + windowDays * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await sb
    .from("calendar_events")
    .select("id, inicio, fim, titulo, videomaker_assigned_id")
    .eq("sub_calendar", "videomakers")
    .eq("videomaker_status", "scheduled")
    .in("videomaker_assigned_id", videomakerIds)
    .gte("inicio", since)
    .lte("inicio", until)
    .order("inicio", { ascending: true });

  const rows = (data ?? []) as Array<{
    id: string;
    inicio: string;
    fim: string;
    titulo: string;
    videomaker_assigned_id: string;
  }>;
  for (const r of rows) {
    const arr = out.get(r.videomaker_assigned_id) ?? [];
    arr.push({ id: r.id, inicio: r.inicio, fim: r.fim, titulo: r.titulo });
    out.set(r.videomaker_assigned_id, arr);
  }
  return out;
}
