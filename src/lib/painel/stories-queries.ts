// SERVER ONLY: do not import from client components
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface StoriesRow {
  client_id: string;
  client_nome: string;
  quantidade_diaria_stories: number;
  postados: number;
  meta: number;
}

/** Nº de dias do mês 'YYYY-MM'. */
export function diasNoMes(mesRef: string): number {
  const [y, m] = mesRef.split("-").map(Number);
  // m é 1-12; dia 0 do próximo mês = último dia do mês corrente.
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * Clientes com stories ativado + contagem do mês. meta = diária × dias do mês.
 *
 * Usa service-role (mesmo padrão de queries.ts): SELECT policies em clients /
 * client_monthly_stories são permissivas por role; a filtragem de segurança
 * fica no unitClientIds passado pelo caller (unidade ativa) + no gate de role
 * na página. `as any` porque tem_stories/quantidade_diaria_stories e a tabela
 * client_monthly_stories ainda não estão nos tipos gerados.
 */
export async function getStoriesForMonth(
  mesRef: string,
  unitClientIds: string[] | null,
): Promise<StoriesRow[]> {
  // Unidade nova sem clientes → nada a mostrar.
  if (unitClientIds !== null && unitClientIds.length === 0) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceRoleClient() as any;

  let clientsQuery = supabase
    .from("clients")
    .select("id, nome, quantidade_diaria_stories")
    .eq("status", "ativo")
    .eq("tem_stories", true);
  if (unitClientIds !== null) {
    clientsQuery = clientsQuery.in("id", unitClientIds);
  }

  const { data: clientsData, error: clientsError } = await clientsQuery.order("nome");
  if (clientsError) {
    console.error("[painel/stories] erro ao listar clientes:", clientsError.message);
    return [];
  }

  const clients = (clientsData ?? []) as Array<{
    id: string;
    nome: string;
    quantidade_diaria_stories: number | null;
  }>;
  if (clients.length === 0) return [];

  const clientIds = clients.map((c) => c.id);

  const { data: monthlyData, error: monthlyError } = await supabase
    .from("client_monthly_stories")
    .select("client_id, quantidade_postada")
    .eq("mes_referencia", mesRef)
    .in("client_id", clientIds);
  if (monthlyError) {
    console.error("[painel/stories] erro ao listar contagem mensal:", monthlyError.message);
  }

  const postadosByClient = new Map<string, number>();
  for (const row of (monthlyData ?? []) as Array<{ client_id: string; quantidade_postada: number | null }>) {
    postadosByClient.set(row.client_id, row.quantidade_postada ?? 0);
  }

  const dias = diasNoMes(mesRef);

  return clients
    .map((c) => {
      const diaria = c.quantidade_diaria_stories ?? 0;
      return {
        client_id: c.id,
        client_nome: c.nome,
        quantidade_diaria_stories: diaria,
        postados: postadosByClient.get(c.id) ?? 0,
        meta: diaria * dias,
      };
    })
    .sort((a, b) => a.client_nome.localeCompare(b.client_nome, "pt-BR"));
}
