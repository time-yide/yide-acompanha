// SERVER ONLY: contas conectadas da Yide por canal (Presença & Autoridade).
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { CANAIS, type Canal } from "./config";

// ------- Tipos de linhas do banco (entrada da função pura) -------
export interface ClienteYide {
  id: string;
  nome: string;
  gmn_location_id: string | null;
  gmn_url: string | null;
}
export interface PostformeAccountRow {
  /** tiktok | youtube | linkedin | instagram | facebook */
  plataforma: string;
  account_id: string;
  username: string | null;
}
export interface OutstandAccountRow {
  /** google_business */
  plataforma: string;
  account_id: string;
  username: string | null;
}
// ------- Saída -------
export interface MetricasCanal {
  posts: number;
  alcance: number;
  interacoes: number;
}
export interface ContaCanal {
  canal: Canal;
  conectado: boolean;
  conta: string | null;
  link: string | null;
  metricas: MetricasCanal | null;
  manual: boolean;
}

export type ContasResultado =
  | { semCliente: true; contas?: undefined; clienteNome?: undefined }
  | { semCliente: false; clienteNome: string; contas: ContaCanal[] };

/** Canais que não são conectáveis neste app (conexão manual, sem conta). */
const CANAIS_MANUAIS: ReadonlySet<Canal> = new Set(["threads", "pinterest", "medium"]);

function linkCliente(clienteId: string): string {
  return `/clientes/${clienteId}`;
}

/**
 * Mapeia linhas do banco → 1 objeto por Canal de config.ts.
 * Puro e testável (sem I/O). Regras:
 * - instagram/facebook/linkedin/tiktok/youtube → client_postforme_accounts.
 * - gmn → client_outstand_accounts (google_business) e/ou clients.gmn_location_id.
 * - threads/pinterest/medium → conexão manual (nunca conectado por aqui).
 */
export function montarContasPorCanal(input: {
  cliente: ClienteYide;
  postforme: PostformeAccountRow[];
  outstand: OutstandAccountRow[];
}): ContaCanal[] {
  const { cliente, postforme, outstand } = input;

  const pfmPorPlat = new Map<string, PostformeAccountRow>();
  for (const a of postforme) if (!pfmPorPlat.has(a.plataforma)) pfmPorPlat.set(a.plataforma, a);

  const gmnAccount = outstand.find((a) => a.plataforma === "google_business") ?? null;

  return CANAIS.map(({ value: canal }): ContaCanal => {
    const manual = CANAIS_MANUAIS.has(canal);
    const link = manual ? null : linkCliente(cliente.id);

    if (manual) {
      return { canal, conectado: false, conta: null, link: null, metricas: null, manual: true };
    }

    let conectado = false;
    let conta: string | null = null;
    let linkFinal: string | null = link;

    if (canal === "gmn") {
      if (gmnAccount) {
        conectado = true;
        conta = gmnAccount.username ?? gmnAccount.account_id;
      } else if (cliente.gmn_location_id) {
        conectado = true;
        conta = cliente.gmn_location_id;
      }
      if (cliente.gmn_url) linkFinal = cliente.gmn_url;
    } else {
      const pfm = pfmPorPlat.get(canal);
      if (pfm) {
        conectado = true;
        conta = pfm.username ?? pfm.account_id;
      }
    }

    return { canal, conectado, conta, link: linkFinal, metricas: null, manual: false };
  });
}

// ------- I/O: resolve o cliente Yide e busca tudo no banco -------
export async function getContasEAnalisesYide(orgId: string): Promise<ContasResultado> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;

  const SELECT = "id, nome, gmn_location_id, gmn_url";
  const cliResp = await sb
    .from("clients")
    .select(SELECT)
    .eq("organization_id", orgId)
    .ilike("nome", "yide%")
    .order("created_at", { ascending: true })
    .limit(1);

  const cliRow = (cliResp.data?.[0] ?? null) as Partial<ClienteYide> & { id?: string; nome?: string } | null;
  if (!cliRow?.id) return { semCliente: true };

  const cliente: ClienteYide = {
    id: cliRow.id,
    nome: cliRow.nome ?? "Yide",
    gmn_location_id: cliRow.gmn_location_id ?? null,
    gmn_url: cliRow.gmn_url ?? null,
  };

  const [pfmResp, osResp] = await Promise.all([
    sb.from("client_postforme_accounts").select("plataforma, account_id, username").eq("client_id", cliente.id),
    sb.from("client_outstand_accounts").select("plataforma, account_id, username").eq("client_id", cliente.id),
  ]);
  const postforme = ((pfmResp.error ? [] : pfmResp.data) ?? []) as PostformeAccountRow[];
  const outstand = ((osResp.error ? [] : osResp.data) ?? []) as OutstandAccountRow[];

  const contas = montarContasPorCanal({ cliente, postforme, outstand });
  return { semCliente: false, clienteNome: cliente.nome, contas };
}
