import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface ClienteComAcesso {
  client_id: string;
  client_nome: string;
  client_ativo: boolean;
  /** Linha do portal user — null se cliente ainda não tem acesso */
  portal: {
    user_id: string;
    email: string;
    nome_contato: string | null;
    ativo: boolean;
    created_at: string;
    last_login_at: string | null;
  } | null;
}

/**
 * Lista TODOS os clientes ativos + (se existe) seu acesso ao portal.
 * Usa service-role pra ler auth.users (email). Filtro: só clientes
 * com status="ativo" (deleted_at IS NULL).
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

  // 2) Portal users desses clientes
  const clientIds = clients.map((c) => c.id);
  const { data: portalData } = await admin
    .from("client_portal_users")
    .select("user_id, client_id, nome_contato, ativo, created_at, last_login_at")
    .in("client_id", clientIds);
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
    // listUsers paginado — pegamos só 1000 por chamada (limite Supabase).
    // Pra agência com <1000 clientes-portal isso é suficiente. Quando passar
    // disso, paginar com loop ou fazer a busca direto na auth schema via SQL.
    const { data: usersData } = await admin.auth.admin.listUsers({ perPage: 1000 });
    for (const u of usersData?.users ?? []) {
      if (u.email && portalUserIds.includes(u.id)) {
        emailByUserId.set(u.id, u.email);
      }
    }
  }

  // 4) Indexa portal rows por client_id
  const portalByClientId = new Map<string, typeof portalRows[number]>();
  for (const p of portalRows) {
    portalByClientId.set(p.client_id, p);
  }

  // 5) Monta resposta
  return clients.map((c) => {
    const portal = portalByClientId.get(c.id);
    return {
      client_id: c.id,
      client_nome: c.nome,
      client_ativo: c.status === "ativo",
      portal: portal
        ? {
            user_id: portal.user_id,
            email: emailByUserId.get(portal.user_id) ?? "—",
            nome_contato: portal.nome_contato,
            ativo: portal.ativo,
            created_at: portal.created_at,
            last_login_at: portal.last_login_at,
          }
        : null,
    };
  });
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
  };
  assessor: { nome: string } | null;
}

/**
 * Dados que o cliente portal vê no dashboard dele. Lê só o próprio client
 * (RLS já garante isso, mas usamos service-role aqui por simplicidade —
 * passando o `clientId` validado pela sessão).
 */
export async function getClientPortalData(clientId: string): Promise<ClientPortalData | null> {
  const admin = createServiceRoleClient();

  // `select("*")` em vez de listar colunas — os types de database.ts ainda
  // não têm `modalidade` (out-of-date), mas a coluna existe no DB.
  // Service-role + cast manual abaixo cobre isso.
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
    },
    assessor,
  };
}
