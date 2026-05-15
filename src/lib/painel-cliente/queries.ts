import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface PortalUser {
  user_id: string;
  email: string;
  nome_contato: string | null;
  ativo: boolean;
  created_at: string;
  last_login_at: string | null;
}

export interface ClienteComAcesso {
  client_id: string;
  client_nome: string;
  client_ativo: boolean;
  /**
   * Todos os acessos do cliente (ativos + revogados), ordenados por
   * created_at DESC. Vazio = cliente sem nenhum acesso ainda.
   */
  portals: PortalUser[];
}

/**
 * Lista TODOS os clientes ativos + seus acessos ao portal (até 5 ativos +
 * histórico de revogados). Usa service-role pra ler auth.users (email).
 */
export async function listClientesComAcessoPortal(): Promise<ClienteComAcesso[]> {
  const admin = createServiceRoleClient();

  // 1) Clientes ativos
  const { data: clientsData } = await admin
    .from("clients")
    .select("id, nome, status")
    .eq("status", "ativo")
    .is("deleted_at", null)
    .order("nome");
  const clients = (clientsData ?? []) as Array<{ id: string; nome: string; status: string }>;

  if (clients.length === 0) return [];

  // 2) Portal users desses clientes (ativos + revogados)
  const clientIds = clients.map((c) => c.id);
  const { data: portalData } = await admin
    .from("client_portal_users")
    .select("user_id, client_id, nome_contato, ativo, created_at, last_login_at")
    .in("client_id", clientIds)
    .order("created_at", { ascending: false });
  const portalRows = (portalData ?? []) as Array<{
    user_id: string;
    client_id: string;
    nome_contato: string | null;
    ativo: boolean;
    created_at: string;
    last_login_at: string | null;
  }>;

  // 3) Emails dos portal users (de auth.users)
  const portalUserIds = portalRows.map((p) => p.user_id);
  const emailByUserId = new Map<string, string>();
  if (portalUserIds.length > 0) {
    // Mesmo padrão de antes — paginação simples (1 página, 1000 users máx).
    // Como agora pode ter até 5x mais portal users (5 por cliente), atenção:
    // com >200 clientes-com-acesso isso vira limitação. Paginar quando passar.
    const { data: usersData } = await admin.auth.admin.listUsers({ perPage: 1000 });
    for (const u of usersData?.users ?? []) {
      if (u.email && portalUserIds.includes(u.id)) {
        emailByUserId.set(u.id, u.email);
      }
    }
  }

  // 4) Agrupa portal rows por client_id
  const portalsByClientId = new Map<string, PortalUser[]>();
  for (const p of portalRows) {
    const list = portalsByClientId.get(p.client_id) ?? [];
    list.push({
      user_id: p.user_id,
      email: emailByUserId.get(p.user_id) ?? "",
      nome_contato: p.nome_contato,
      ativo: p.ativo,
      created_at: p.created_at,
      last_login_at: p.last_login_at,
    });
    portalsByClientId.set(p.client_id, list);
  }

  // 5) Monta resposta
  return clients.map((c) => ({
    client_id: c.id,
    client_nome: c.nome,
    client_ativo: c.status === "ativo",
    portals: portalsByClientId.get(c.id) ?? [],
  }));
}

export interface ClientPortalData {
  cliente: {
    id: string;
    nome: string;
    valor_mensal: number;
    servico_contratado: string | null;
    data_entrada: string;
    tipo_pacote: string | null;
    modalidade: string | null;
    valor_trafego_google: number | null;
    valor_trafego_meta: number | null;
    drive_url: string | null;
    /** Link do perfil GMB (Google Maps). */
    gmb_link: string | null;
    /** Nota média 0-5 do GMB. Manual por enquanto. */
    gmb_rating: number | null;
    /** Quantidade de reviews. */
    gmb_review_count: number | null;
    /** Quando esses dados foram atualizados pela última vez. */
    gmb_last_update_at: string | null;
  };
  assessor: { nome: string } | null;
}

/**
 * Dados que o cliente portal vê no dashboard dele. Lê só o próprio client.
 */
export async function getClientPortalData(clientId: string): Promise<ClientPortalData | null> {
  const admin = createServiceRoleClient();

  const { data: clientData } = await admin
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .single();

  if (!clientData) return null;
  const client = clientData as unknown as {
    id: string;
    nome: string;
    valor_mensal: number;
    servico_contratado: string | null;
    data_entrada: string;
    tipo_pacote: string | null;
    modalidade: string | null;
    valor_trafego_google: number | null;
    valor_trafego_meta: number | null;
    drive_url: string | null;
    assessor_id: string | null;
    gmb_link: string | null;
    gmb_rating: number | string | null; // numeric vem como string às vezes
    gmb_review_count: number | null;
    gmb_last_update_at: string | null;
  };

  let assessor: { nome: string } | null = null;
  if (client.assessor_id) {
    const { data: a } = await admin
      .from("profiles")
      .select("nome")
      .eq("id", client.assessor_id)
      .single();
    if (a) assessor = { nome: (a as { nome: string }).nome };
  }

  return {
    cliente: {
      id: client.id,
      nome: client.nome,
      valor_mensal: client.valor_mensal,
      servico_contratado: client.servico_contratado,
      data_entrada: client.data_entrada,
      tipo_pacote: client.tipo_pacote,
      modalidade: client.modalidade,
      valor_trafego_google: client.valor_trafego_google,
      valor_trafego_meta: client.valor_trafego_meta,
      drive_url: client.drive_url,
      gmb_link: client.gmb_link,
      gmb_rating: client.gmb_rating !== null ? Number(client.gmb_rating) : null,
      gmb_review_count: client.gmb_review_count,
      gmb_last_update_at: client.gmb_last_update_at,
    },
    assessor,
  };
}
