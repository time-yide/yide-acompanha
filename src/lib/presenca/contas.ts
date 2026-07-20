// SERVER ONLY: contas conectadas da Yide + métricas por canal (Presença & Autoridade).
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { CANAIS, type Canal } from "./config";

// ------- Tipos de linhas do banco (entrada da função pura) -------
export interface ClienteYide {
  id: string;
  nome: string;
  instagram_business_id: string | null;
  facebook_page_id: string | null;
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
export interface PostRedeRow {
  id: string;
  redes: string[];
  status: string;
}
export interface MetricaRow {
  post_id: string;
  /** instagram | facebook */
  rede: string;
  metrica: string;
  valor: number;
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
/** Redes de metrica.rede que têm métricas neste v1. */
const REDES_COM_METRICA: Record<string, Canal> = { instagram: "instagram", facebook: "facebook" };
/** Métricas que somam como "interações". */
const METRICAS_INTERACAO = new Set(["curtidas", "comentarios", "salvamentos", "compartilhamentos"]);

/** Link pra conectar a conta na Estratégia (página do cliente Yide no /social-media). */
function linkEstrategia(clienteId: string): string {
  return `/social-media/${clienteId}`;
}

/**
 * Mapeia linhas do banco → 1 objeto por Canal de config.ts.
 * Puro e testável (sem I/O). Regras:
 * - instagram/facebook/linkedin/tiktok/youtube → client_postforme_accounts;
 *   IG/FB também aceitam o modo nativo do Meta (clients.instagram_business_id / facebook_page_id).
 * - gmn → client_outstand_accounts (google_business) e/ou clients.gmn_location_id.
 * - threads/pinterest/medium → conexão manual (nunca conectado por aqui).
 * - métricas (só IG/FB): agrega posts com status 'publicado' que incluam a rede.
 */
export function montarContasPorCanal(input: {
  cliente: ClienteYide;
  postforme: PostformeAccountRow[];
  outstand: OutstandAccountRow[];
  posts: PostRedeRow[];
  metricas: MetricaRow[];
}): ContaCanal[] {
  const { cliente, postforme, outstand, posts, metricas } = input;

  // Índice de contas postforme por plataforma.
  const pfmPorPlat = new Map<string, PostformeAccountRow>();
  for (const a of postforme) if (!pfmPorPlat.has(a.plataforma)) pfmPorPlat.set(a.plataforma, a);

  // Conta outstand (Google) — pega a primeira google_business.
  const gmnAccount = outstand.find((a) => a.plataforma === "google_business") ?? null;

  // Métricas agregadas por rede: só posts publicados que incluam a rede.
  const postsPublicados = new Set(posts.filter((p) => p.status === "publicado").map((p) => p.id));
  const postsPorRede = new Map<string, Set<string>>(); // rede → set de postIds publicados
  for (const p of posts) {
    if (p.status !== "publicado") continue;
    for (const rede of p.redes) {
      if (!(rede in REDES_COM_METRICA)) continue;
      const set = postsPorRede.get(rede) ?? new Set<string>();
      set.add(p.id);
      postsPorRede.set(rede, set);
    }
  }
  const agregadoPorRede = new Map<string, { alcance: number; interacoes: number }>();
  for (const m of metricas) {
    if (!(m.rede in REDES_COM_METRICA)) continue;
    if (!postsPublicados.has(m.post_id)) continue;
    const acc = agregadoPorRede.get(m.rede) ?? { alcance: 0, interacoes: 0 };
    const valor = Number(m.valor) || 0;
    if (m.metrica === "alcance") acc.alcance += valor;
    else if (METRICAS_INTERACAO.has(m.metrica)) acc.interacoes += valor;
    agregadoPorRede.set(m.rede, acc);
  }

  function metricasDoCanal(canal: Canal): MetricasCanal | null {
    if (canal !== "instagram" && canal !== "facebook") return null;
    const posts = postsPorRede.get(canal)?.size ?? 0;
    const agg = agregadoPorRede.get(canal) ?? { alcance: 0, interacoes: 0 };
    return { posts, alcance: agg.alcance, interacoes: agg.interacoes };
  }

  return CANAIS.map(({ value: canal }): ContaCanal => {
    const manual = CANAIS_MANUAIS.has(canal);
    const link = manual ? null : linkEstrategia(cliente.id);

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
      // gmn_url (link direto do perfil) tem prioridade como link quando existe.
      if (cliente.gmn_url) linkFinal = cliente.gmn_url;
    } else {
      const pfm = pfmPorPlat.get(canal);
      if (pfm) {
        conectado = true;
        conta = pfm.username ?? pfm.account_id;
      } else if (canal === "instagram" && cliente.instagram_business_id) {
        conectado = true;
        conta = cliente.instagram_business_id;
      } else if (canal === "facebook" && cliente.facebook_page_id) {
        conectado = true;
        conta = cliente.facebook_page_id;
      }
    }

    return { canal, conectado, conta, link: linkFinal, metricas: metricasDoCanal(canal), manual: false };
  });
}

// ------- I/O: resolve o cliente Yide e busca tudo no banco -------
export async function getContasEAnalisesYide(orgId: string): Promise<ContasResultado> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;

  // 1) Cliente Yide (case-insensitive, org ativa). Fallback tolera coluna nova ausente.
  const SELECT_COMPLETO = "id, nome, instagram_business_id, facebook_page_id, gmn_location_id, gmn_url";
  const SELECT_FALLBACK = "id, nome";
  const buildCliente = (sel: string) =>
    sb
      .from("clients")
      .select(sel)
      .eq("organization_id", orgId)
      .ilike("nome", "yide")
      .order("created_at", { ascending: true })
      .limit(1);

  let cliResp = await buildCliente(SELECT_COMPLETO);
  if (cliResp.error) {
    const msg = cliResp.error.message ?? "";
    if (msg.includes("instagram_business_id") || msg.includes("gmn_") || msg.includes("schema cache")) {
      cliResp = await buildCliente(SELECT_FALLBACK);
    }
  }
  const cliRow = (cliResp.data?.[0] ?? null) as Partial<ClienteYide> & { id?: string; nome?: string } | null;
  if (!cliRow?.id) return { semCliente: true };

  const cliente: ClienteYide = {
    id: cliRow.id,
    nome: cliRow.nome ?? "Yide",
    instagram_business_id: cliRow.instagram_business_id ?? null,
    facebook_page_id: cliRow.facebook_page_id ?? null,
    gmn_location_id: cliRow.gmn_location_id ?? null,
    gmn_url: cliRow.gmn_url ?? null,
  };

  // 2) Contas conectadas (postforme + outstand). Toleram tabela ausente.
  const [pfmResp, osResp] = await Promise.all([
    sb.from("client_postforme_accounts").select("plataforma, account_id, username").eq("client_id", cliente.id),
    sb.from("client_outstand_accounts").select("plataforma, account_id, username").eq("client_id", cliente.id),
  ]);
  const postforme = ((pfmResp.error ? [] : pfmResp.data) ?? []) as PostformeAccountRow[];
  const outstand = ((osResp.error ? [] : osResp.data) ?? []) as OutstandAccountRow[];

  // 3) Posts publicados do cliente + métricas (pra IG/FB).
  const postsResp = await sb
    .from("social_media_posts")
    .select("id, redes, status")
    .eq("client_id", cliente.id)
    .is("archived_at", null);
  const posts = ((postsResp.error ? [] : postsResp.data) ?? []) as PostRedeRow[];

  let metricas: MetricaRow[] = [];
  const idsPublicados = posts.filter((p) => p.status === "publicado").map((p) => p.id);
  if (idsPublicados.length > 0) {
    const metResp = await sb
      .from("social_media_metricas")
      .select("post_id, rede, metrica, valor")
      .in("post_id", idsPublicados);
    metricas = ((metResp.error ? [] : metResp.data) ?? []) as MetricaRow[];
  }

  const contas = montarContasPorCanal({ cliente, postforme, outstand, posts, metricas });
  return { semCliente: false, clienteNome: cliente.nome, contas };
}
