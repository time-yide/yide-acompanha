// SERVER ONLY
import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface ContratoInfo {
  client_id: string;
  razao_social: string | null;
  cnpj_cpf: string | null;
  endereco: string | null;
  email: string | null;
  telefone: string | null;
  updated_at: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

/** Info de contrato de UM cliente (portal). null quando ainda não preencheu. */
export async function getContratoInfo(clientId: string): Promise<ContratoInfo | null> {
  const sb = createServiceRoleClient() as SB;
  const { data } = await sb
    .from("client_contract_info")
    .select("client_id, razao_social, cnpj_cpf, endereco, email, telefone, updated_at")
    .eq("client_id", clientId)
    .maybeSingle();
  return (data as ContratoInfo | null) ?? null;
}

export interface ContratoFinanceRow {
  clientId: string;
  clientNome: string;
  info: ContratoInfo | null;
}

/** Todos os clientes ativos + a info de contrato (null = pendente). Pro Financeiro. */
export async function listContratosForFinance(): Promise<ContratoFinanceRow[]> {
  const sb = createServiceRoleClient() as SB;
  const [{ data: clientes }, { data: infos }] = await Promise.all([
    sb.from("clients").select("id, nome").eq("status", "ativo").order("nome"),
    sb.from("client_contract_info").select("client_id, razao_social, cnpj_cpf, endereco, email, telefone, updated_at"),
  ]);
  const infoPorCliente = new Map<string, ContratoInfo>();
  for (const i of (infos ?? []) as ContratoInfo[]) infoPorCliente.set(i.client_id, i);
  return ((clientes ?? []) as Array<{ id: string; nome: string }>).map((c) => ({
    clientId: c.id,
    clientNome: c.nome,
    info: infoPorCliente.get(c.id) ?? null,
  }));
}
