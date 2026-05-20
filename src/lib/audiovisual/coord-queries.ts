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

export interface ScheduledFutureRow {
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
  videomaker_assigned_id: string;
  videomaker_nome: string | null;
  videomaker_delegado_por: string | null;
  videomaker_delegado_em: string | null;
  delegado_por_nome: string | null;
}

/**
 * Lista eventos de videomaker JÁ delegados (`status=scheduled`) que ainda
 * não aconteceram (`inicio >= now()`). Mostra quem foi delegado e por quem,
 * pra coord saber o que já tá agendado vs. ainda falta delegar.
 *
 * `unitClientIds`: mesmo padrão do `listPendingDelegations` — null = sem
 * filtro, [] = unidade vazia, [ids] = filtra por client da unidade.
 */
export async function listScheduledFutureCaptures(
  unitClientIds: string[] | null = null,
): Promise<ScheduledFutureRow[]> {
  if (unitClientIds !== null && unitClientIds.length === 0) return [];

  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = sb
    .from("calendar_events")
    .select(`
      id, titulo, inicio, fim, client_id,
      localizacao_endereco, localizacao_maps_url, link_roteiro, observacoes_gravacao,
      videomaker_assigned_id, videomaker_delegado_por, videomaker_delegado_em,
      cliente:clients(nome),
      videomaker:profiles!calendar_events_videomaker_assigned_id_fkey(nome),
      delegado_por:profiles!calendar_events_videomaker_delegado_por_fkey(nome)
    `)
    .eq("sub_calendar", "videomakers")
    .eq("videomaker_status", "scheduled")
    .gte("inicio", new Date().toISOString());

  if (unitClientIds !== null) {
    q = q.or(`client_id.in.(${unitClientIds.join(",")}),client_id.is.null`);
  }

  const { data, error } = await q.order("inicio", { ascending: true });

  if (error) {
    // Fallback: se os nomes das FK constraint ainda não baterem nesse banco,
    // re-tenta com join mais simples por coluna.
    const msg = String(error.message ?? "");
    if (msg.includes("relationship") || msg.includes("schema cache")) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let fb: any = sb
        .from("calendar_events")
        .select(`
          id, titulo, inicio, fim, client_id,
          localizacao_endereco, localizacao_maps_url, link_roteiro, observacoes_gravacao,
          videomaker_assigned_id, videomaker_delegado_por, videomaker_delegado_em,
          cliente:clients(nome)
        `)
        .eq("sub_calendar", "videomakers")
        .eq("videomaker_status", "scheduled")
        .gte("inicio", new Date().toISOString());
      if (unitClientIds !== null) {
        fb = fb.or(`client_id.in.(${unitClientIds.join(",")}),client_id.is.null`);
      }
      const fbResp = await fb.order("inicio", { ascending: true });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = (fbResp.data ?? []) as any[];
      // Resolve nomes dos profiles em batch
      const profileIds = Array.from(new Set(rows.flatMap((r) =>
        [r.videomaker_assigned_id, r.videomaker_delegado_por].filter(Boolean) as string[],
      )));
      const nameById = new Map<string, string>();
      if (profileIds.length > 0) {
        const { data: profs } = await sb
          .from("profiles")
          .select("id, nome")
          .in("id", profileIds);
        ((profs ?? []) as Array<{ id: string; nome: string }>).forEach((p) => nameById.set(p.id, p.nome));
      }
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
        videomaker_assigned_id: r.videomaker_assigned_id,
        videomaker_nome: nameById.get(r.videomaker_assigned_id) ?? null,
        videomaker_delegado_por: r.videomaker_delegado_por,
        videomaker_delegado_em: r.videomaker_delegado_em,
        delegado_por_nome: r.videomaker_delegado_por ? nameById.get(r.videomaker_delegado_por) ?? null : null,
      }));
    }
    console.error("[audiovisual/coord] listScheduledFutureCaptures failed:", error);
    return [];
  }

  const rows = (data ?? []) as Array<{
    id: string;
    titulo: string;
    inicio: string;
    fim: string;
    client_id: string | null;
    localizacao_endereco: string | null;
    localizacao_maps_url: string | null;
    link_roteiro: string | null;
    observacoes_gravacao: string | null;
    videomaker_assigned_id: string;
    videomaker_delegado_por: string | null;
    videomaker_delegado_em: string | null;
    cliente?: { nome: string } | null;
    videomaker?: { nome: string } | null;
    delegado_por?: { nome: string } | null;
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
    videomaker_assigned_id: r.videomaker_assigned_id,
    videomaker_nome: r.videomaker?.nome ?? null,
    videomaker_delegado_por: r.videomaker_delegado_por,
    videomaker_delegado_em: r.videomaker_delegado_em,
    delegado_por_nome: r.delegado_por?.nome ?? null,
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
